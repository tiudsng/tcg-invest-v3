#!/usr/bin/env python3
"""
PSA Batch Discovery — Async URL Discovery + PSA Extraction
==========================================================
1. Read cards from new_products (or pokeca_gold)
2. For each card: Search-First URL discovery
3. Extract PSA population data
4. Write to psa_prices collection in Firestore
5. Cache URL status for future O(1) lookups

Usage:
    python3 scripts/psa_batch_discovery.py [--source new_products|pokeca_gold] [--limit N]
"""
import asyncio
import os
import random
import re
import sys
import time
import json as json_module
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore
from google.oauth2 import service_account
from curl_cffi import requests as curl_requests

# ── Config ──────────────────────────────────────────────────────────────────
FIREBASE_CRED_PATH = Path(os.environ.get(
    "FIREBASE_CRED_PATH",
    "~/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json"
)).expanduser()
PROJECT_ID = "gen-lang-client-0326385388"
FIRESTORE_DB = "ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Firebase Init ────────────────────────────────────────────────────────────
def init_firebase():
    """Initialize Firestore client using google.cloud.firestore.Client directly."""
    creds_dict_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if creds_dict_str:
        creds_dict = json_module.loads(creds_dict_str)
        creds = service_account.Credentials.from_service_account_info(creds_dict)
    else:
        creds_dict = json_module.loads(Path(FIREBASE_CRED_PATH).read_text())
        creds = service_account.Credentials.from_service_account_info(creds_dict)
    
    client = firestore.Client(
        credentials=creds,
        project=PROJECT_ID,
        database=FIRESTORE_DB
    )
    return client

db = init_firebase()

# ── URL Cache (local file for O(1) lookups) ─────────────────────────────────
CACHE_FILE = Path("/tmp/pc_url_cache.json")

def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json_module.loads(CACHE_FILE.read_text())
    return {}

def save_cache(cache: dict):
    CACHE_FILE.write_text(json_module.dumps(cache, ensure_ascii=False, indent=2))

# ── PSA Extraction ───────────────────────────────────────────────────────────
def extract_psa_data(html: str) -> Optional[dict]:
    """Extract PSA population from PriceCharting HTML."""
    patterns = [
        r'VGPC\.pop_data\s*=\s*\{[^}]*?psa:\s*\[([^\]]+)\]',
        r'"psa":\s*\[([^\]]+)\]',
        r'psa:\s*\[([\d,]+)\]',
    ]
    for i, pat in enumerate(patterns):
        m = re.search(pat, html)
        if m:
            vals = [int(x) for x in m.group(1).split(",")]
            if len(vals) == 10:
                total = sum(vals)
                psa10 = vals[9]
                return {
                    "psa": vals,
                    "total": total,
                    "psa10": psa10,
                    "psa9": vals[8] if len(vals) > 8 else 0,
                    "gem_mt_rate": round(psa10 / total, 4) if total > 0 else 0,
                    "pattern": i
                }
    return None

# ── URL Discovery Patterns ───────────────────────────────────────────────────
def generate_candidates(set_code: str, card_number: str, name_jp: str = "") -> list:
    """Generate candidate URLs for a card."""
    num = card_number.lstrip('0').zfill(3) if card_number.replace("/", "", 1).isdigit() else card_number
    num_raw = card_number.replace("/", "-")
    
    # Clean name for slug
    name_lower = name_jp.lower()
    for jp, en in [('ミュウツー', 'mewtwo'), ('ミュウ', 'mew'), (' Pikachu', 'pikachu'),
                    ('リザードン', 'charizard'), ('ラプラス', 'lapras'), ('サンダース', 'jolteon'),
                    ('而上', ''), ('EX', 'ex'), ('VMAX', 'vmax'), ('VSTAR', 'vstar'),
                    ('GX', 'gx'), ('SR', 'sr'), ('RR', 'rr'), ('UR', 'ur'),
                    ('SAR', 'sar'), ('1ED', '1ed'), ('HR', 'hr'), ('★', 'star'),
                    ('☆', 'star'), (' ', '-')]:
        name_lower = name_lower.replace(jp.lower(), en.lower())
    
    name_slug = re.sub(r'[^a-z0-9]+', '-', name_lower).strip('-')[:50]
    name_slug_encoded = name_slug.replace('&', '%26')
    
    # Set → category hints (expanded)
    set_hints = {
        'sm11': ['pokemon-japanese-sky-legend', 'pokemon-japanese-sm11', 'pokemon-sun-moon-promos', 'pokemon-japanese-miracle-twins'],
        'swsh6': ['pokemon-sword-shield-fusion-strike', 'pokemon-sword-shield', 'pokemon-swsh'],
        'xy9': ['pokemon-xy-fates', 'pokemon-xy'],
        'base1': ['pokemon-wizards-black-star-promos', 'pokemon-base', 'pokemon-promo'],
        'm2': ['pokemon-x2', 'pokemon-m2'],
        'sv2d': ['pokemon-scarlet-violet-prismatic-evolution', 'pokemon-scarlet-violet'],
        'sv4a': ['pokemon-scarlet-violet-temporal-forces', 'pokemon-scarlet-violet'],
        's12a': ['pokemon-twisted-space', 'pokemon-scarlet-violet'],
        'sv3a': ['pokemon-scarlet-violet-obsidian-flames', 'pokemon-scarlet-violet'],
        'sv5a': ['pokemon-scarlet-violet-paldea-evolved', 'pokemon-scarlet-violet'],
    }
    
    categories = set_hints.get(set_code, ['pokemon-japanese-promo', 'pokemon-promo'])
    
    candidates = []
    slug_variants = [
        f"{name_slug}-{num}",
        f"{name_slug_encoded}-{num}",
        f"{name_slug}-{num_raw}",
    ]
    
    for cat in categories:
        for slug in slug_variants:
            candidates.append((f"https://www.pricecharting.com/game/{cat}/{slug}", slug))
    
    return candidates[:15]

# ── Async HTTP Fetcher ────────────────────────────────────────────────────────
async def fetch_url(session, url: str, retries: int = 2) -> dict:
    """Async fetch a single URL with random delay + retry on Cloudflare challenge."""
    for attempt in range(retries + 1):
        # Random delay 1-3s between EACH request — the "slow is fast" rule
        await asyncio.sleep(random.uniform(1.0, 3.0))
        
        try:
            resp = await session.get(
                url,
                headers=HEADERS,
                impersonate="chrome",
                timeout=15
            )
            if resp.status_code == 200:
                title_m = re.search(r'<title>([^<]+)</title>', resp.text)
                title = title_m.group(1) if title_m else ""
                sample = resp.text[:300].replace('\n', ' ')
                
                # Check for Cloudflare challenge page
                if "Just a moment" in resp.text or "Checking your browser" in resp.text:
                    if attempt < retries:
                        wait = random.uniform(5, 10)
                        print(f"    [CF Challenge] Retry {attempt+1}/{retries} after {wait:.1f}s...")
                        await asyncio.sleep(wait)
                        continue
                    return {
                        "url": url, "status": 200, "title": title,
                        "psa": None, "sample": sample, "cf_blocked": True
                    }
                
                psa = extract_psa_data(resp.text)
                return {
                    "url": url,
                    "status": 200,
                    "title": title,
                    "psa": psa,
                    "sample": sample,
                }
            return {"url": url, "status": resp.status_code}
        except Exception as e:
            if attempt < retries:
                await asyncio.sleep(random.uniform(2, 5))
                continue
            return {"url": url, "status": "ERROR", "error": str(e)[:100]}
    
    return {"url": url, "status": "EXHAUSTED"}

async def discover_card(session, set_code: str, card_number: str, name_jp: str, doc_id: str) -> dict:
    """Discover URL + PSA data for a single card."""
    cache = load_cache()
    cache_key = f"{set_code}_{card_number}"
    
    # Check cache first
    if cache_key in cache:
        cached = cache[cache_key]
        if cached.get("status") == "verified":
            print(f"  [{cache_key}] CACHED → {cached['pc_url']}")
            return cached
    
    candidates = generate_candidates(set_code, card_number, name_jp)
    
    # Try each candidate concurrently
    print(f"  [{cache_key}] Trying {len(candidates)} candidates...")
    tasks = [fetch_url(session, url) for url, _ in candidates]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Find first working URL with PSA data
    best = None
    debug_shown = 0
    for (url, slug), result in zip(candidates, results):
        if isinstance(result, Exception):
            if debug_shown < 2:
                print(f"    [E] {type(result).__name__}: {str(result)[:60]}")
                debug_shown += 1
            continue
        if result.get("status") == 200:
            psa = result.get("psa")
            has_psa = bool(psa)
            sample = result.get("sample", "")[:100].replace('\n', ' ')
            if debug_shown < 2:
                print(f"    [200] {'PSA✅' if has_psa else 'PSA❌'} {result.get('title','')[:35]} | sample:{sample[:60]}")
                debug_shown += 1
            
            if has_psa and best is None:
                best = {
                    "pc_url": result["url"],
                    "pc_title": result["title"],
                    "psa_data": psa,
                    "status": "verified"
                }
                print(f"  [{cache_key}] ✅ {result['title'][:40]} | PSA10={psa['psa10']} Gem={psa['gem_mt_rate']}%")
                break
            elif has_psa is False and best is None:
                best = {
                    "pc_url": result["url"],
                    "pc_title": result["title"],
                    "psa_data": None,
                    "status": "url_found_no_psa"
                }
    
    if best is None:
        print(f"  [{cache_key}] ❌ No working URL found")
        best = {"status": "not_found", "psa_data": None}
    
    # Update cache
    cache[cache_key] = {
        **best,
        "set_code": set_code,
        "card_number": card_number,
        "name_jp": name_jp,
        "doc_id": doc_id,
        "cached_at": time.time()
    }
    save_cache(cache)
    
    return best

async def process_card(session, doc_data: dict, doc_id: str) -> dict:
    """Process a single card: discover URL, extract PSA, prepare Firestore write."""
    set_code = doc_data.get("set_code", "")
    card_number = doc_data.get("card_number", "")
    name_jp = doc_data.get("name_jp", "")
    
    result = await discover_card(session, set_code, card_number, name_jp, doc_id)
    
    firestore_data = {
        "card_id": f"{set_code}_{card_number}".replace("/", "_"),
        "name_jp": name_jp,
        "set_code": set_code,
        "card_number": card_number,
        "pc_url": result.get("pc_url", ""),
        "pc_url_status": result.get("status", "unknown"),
        "last_updated": firestore.SERVER_TIMESTAMP,
    }
    
    if result.get("psa_data"):
        psa = result["psa_data"]
        firestore_data["psa_data"] = {
            "psa_10_pop": psa["psa10"],
            "psa_9_pop": psa["psa9"],
            "total_pop": psa["total"],
            "gem_mt_rate": psa["gem_mt_rate"],
        }
        firestore_data["psa_raw"] = psa["psa"]
    
    return firestore_data

def write_to_firestore(results: list):
    """Batch write results to Firestore."""
    batch = db.batch()
    count = 0
    for data in results:
        if data.get("pc_url_status") in ["verified", "url_found_no_psa"]:
            doc_id = data["card_id"]
            doc_ref = db.collection("psa_prices").document(doc_id)
            batch.set(doc_ref, data)
            count += 1
    
    batch.commit()
    print(f"\n📝 Wrote {count} documents to Firestore psa_prices")
    return count

async def main(source: str = "new_products", limit: int = 100):
    """Main async batch processor."""
    # Load cards from Firestore
    print(f"📥 Loading cards from {source}...")
    
    collection_map = {
        "new_products": db.collection("new_products"),
        "pokeca_gold": db.collection("pokeca_gold"),
    }
    
    docs = list(collection_map.get(source, db.collection(source)).limit(limit).stream())
    print(f"   Found {len(docs)} cards")
    
    cards = [(d.id, d.to_dict()) for d in docs]
    
    # Async process all cards with concurrency limit
    print(f"\n🔍 Starting URL discovery + PSA extraction...")
    
    connector = curl_requests.AsyncSession()
    
    semaphore = asyncio.Semaphore(1)  # Sequential — slowest but most stealthy
    
    async def bounded_process(doc_id, doc_data):
        async with semaphore:
            # Random delay 1-3s to avoid bot detection patterns
            await asyncio.sleep(random.uniform(1.0, 3.0))
            return await process_card(connector, doc_data, doc_id)
    
    tasks = [bounded_process(doc_id, data) for doc_id, data in cards]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    await connector.close()
    
    # Filter out exceptions
    valid_results = [r for r in results if isinstance(r, dict)]
    failed = [r for r in results if isinstance(r, Exception)]
    
    print(f"\n✅ Completed: {len(valid_results)} | ❌ Failed: {len(failed)}")
    
    # Write to Firestore
    write_count = write_to_firestore(valid_results)
    
    # Summary
    verified = sum(1 for r in valid_results if r.get("pc_url_status") == "verified")
    url_only = sum(1 for r in valid_results if r.get("pc_url_status") == "url_found_no_psa")
    not_found = sum(1 for r in valid_results if r.get("pc_url_status") == "not_found")
    
    print(f"\n📊 Summary:")
    print(f"   Verified (PSA ✅): {verified}")
    print(f"   URL found only:   {url_only}")
    print(f"   Not found:       {not_found}")
    
    return valid_results

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="new_products")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    
    asyncio.run(main(args.source, args.limit))