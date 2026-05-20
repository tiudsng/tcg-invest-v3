#!/usr/bin/env python3
"""
PriceCharting Historical Data Crawler
Fetches PSA population + price history for Pokemon cards.
Writes to Firestore price_history collection.

Usage:
    python3 scripts/price_history_crawler.py --limit 10
    python3 scripts/price_history_crawler.py --test
    USE_TOR=1 python3 scripts/price_history_crawler.py --test

Environment:
    USE_TOR=1                    - Route via Tor SOCKS5 (for CVM)
    FIREBASE_ADMIN_SA_JSON       - Path to SA JSON (for GA runner)
    DATABASE_ID                  - Firestore database ID
"""

import os
import re
import json
import time
import random
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Third-party
try:
    from curl_cffi import requests
except ImportError:
    print("ERROR: curl_cffi not installed. Run: pip install curl_cffi")
    raise SystemExit(1)

try:
    from google.cloud import firestore
    HAS_FIRESTORE = True
except ImportError:
    HAS_FIRESTORE = False

# ─── Constants ────────────────────────────────────────────
PROJECT_ID = "gen-lang-client-0326385388"
DATABASE_ID = "ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"
SA_FILE = "/home/ubuntu/tcg-invest-v3/firebase-admin-sa.json"

BROWSER_FINGERPRINTS = [
    "chrome120", "chrome110", "chrome99",
]

# PriceCharting chart_data keys → grade labels
GRADE_KEYS = ["graded", "new", "used", "cib", "boxonly", "manualonly"]

# ─── Helpers ──────────────────────────────────────────────

def get_session():
    """Create curl_cffi session with optional Tor proxy."""
    fp = random.choice(BROWSER_FINGERPRINTS)
    proxies = None
    
    if os.environ.get("USE_TOR", "").lower() in ("1", "true", "yes"):
        proxies = {
            "http": "socks5://localhost:9050",
            "https": "socks5://localhost:9050",
        }
    
    return requests.Session(impersonate=fp, proxies=proxies)


def parse_chart_data(html):
    """Extract VGPC.chart_data (historical price time-series)."""
    m = re.search(r'VGPC\.chart_data\s*=\s*({.*?});\s*$', html, re.MULTILINE | re.DOTALL)
    if not m:
        return None
    return json.loads(m.group(1))


def parse_pop_data(html):
    """Extract VGPC.pop_data (PSA population counts)."""
    m = re.search(r'VGPC\.pop_data\s*=\s*({[^;]+});', html)
    if not m:
        return None
    return json.loads(m.group(1))


def parse_current_prices(html):
    """
    Extract current grade prices from all .js-price spans in the page.
    Returns dict: {grade_label: price_string}
    """
    # Find all <span class="price js-price">$XX.XX</span>
    all_spans = re.findall(r'<span class="price js-price">\s*([$\d.]+)', html)
    if not all_spans:
        return {}
    
    # Map to grade based on position in price_data table
    # Table structure: Ungraded | Grade 7 | Grade 8 | [Grade 9 | Grade 9.5 | PSA 10]
    # Standard spans order (first 6): used, complete(new), new, graded, box_only, manual_only
    # But actual order in HTML may vary
    # We extract from the price_data table specifically
    
    prices = {}
    table_m = re.search(r'<table[^>]*id="price_data"[^>]*>(.*?)</table>', html, re.DOTALL)
    if table_m:
        table = table_m.group(1)
        
        # Find each price cell by td id
        # used_price → ungraded, complete_price → grade_7, new_price → grade_8
        # graded_price → psa_10, box_only_price → box_only, manual_only_price → manual_only
        
        td_map = {
            "used_price": "ungraded",
            "complete_price": "grade_7",
            "new_price": "grade_8",
            "graded_price": "psa_10",
            "box_only_price": "box_only",
            "manual_only_price": "manual_only",
        }
        
        for td_id, grade in td_map.items():
            # Find the td block, then the price span within
            td_m = re.search(
                r'<td[^>]*id="' + re.escape(td_id) + r'"[^>]*>(.*?)</td>',
                table, re.DOTALL
            )
            if td_m:
                price_m = re.search(r'\$([\d.]+)', td_m.group(1))
                if price_m:
                    prices[grade] = "$" + price_m.group(1)
    
    return prices


def parse_product_meta(html):
    """Extract card metadata from VGPC.product JS object."""
    m = re.search(r'VGPC\.product\s*=\s*\{(.*?)\};', html, re.DOTALL)
    if not m:
        return {}
    
    pairs = re.findall(r'(\w+)\s*:\s*"([^"]*)"', m.group(1))
    return dict(pairs)


def format_history(chart_data, grade_key):
    """
    Convert chart_data series to map {timestamp_ms: price_cents}.
    Firestore can't store arrays of arrays → use map.
    """
    series = chart_data.get(grade_key, [])
    if not series:
        return {}
    
    result = {}
    for point in series:
        if isinstance(point, list) and len(point) == 2:
            ts = int(point[0])          # milliseconds timestamp
            price = int(point[1])        # price in cents
            result[str(ts)] = price      # key must be string for Firestore map
    
    return result


def save_to_firestore(card_id, data, db_client):
    """Write price history data to Firestore price_history collection."""
    if db_client is None:
        return False
    
    doc_ref = db_client.collection("price_history").document(card_id)
    
    doc_data = {
        "card_id": card_id,
        "set_code": data.get("set_code", ""),
        "card_number": data.get("card_number", ""),
        "source": "pricecharting",
        "last_updated": firestore.SERVER_TIMESTAMP,
    }
    
    # PSA population
    if data.get("psa_pop"):
        psa = data["psa_pop"]
        total = sum(psa)
        doc_data["psa_population"] = {
            "psa1": psa[0], "psa2": psa[1], "psa3": psa[2], "psa4": psa[3],
            "psa5": psa[4], "psa6": psa[5], "psa7": psa[6], "psa8": psa[7],
            "psa9": psa[8], "psa10": psa[9],
        }
        doc_data["psa_total"] = total
        doc_data["psa10_pct"] = round(psa[9] / total * 100, 2) if total > 0 else 0
    
    # Current prices (map of grade → price string like "$150.00")
    if data.get("prices"):
        doc_data["current_prices"] = data["prices"]
    
    # Historical price series (map of grade → {ts: price_cents})
    for grade_key in GRADE_KEYS:
        hist = data.get("history", {}).get(grade_key, {})
        if hist:
            doc_data[f"history_{grade_key}"] = hist
    
    doc_ref.set(doc_data, merge=True)
    return True


# ─── Main Crawl Logic ──────────────────────────────────────

def crawl_card(session, card_slug, set_code, card_number, db_client=None):
    """
    Crawl a single card's price history from PriceCharting.
    """
    url = f"https://www.pricecharting.com/game/{card_slug}"
    
    try:
        time.sleep(random.uniform(1.0, 3.0))
        
        r = session.get(url, timeout=30)
        
        if r.status_code == 403:
            print(f"  [CF BLOCK] Status 403")
            return None
        
        if r.status_code != 200:
            print(f"  [FAIL] Status {r.status_code}")
            return None
        
        if "Just a moment" in r.text or "Access denied" in r.text:
            print(f"  [CF CHALLENGE]")
            return None
        
        html = r.text
        result = {"set_code": set_code, "card_number": card_number}
        
        # 1. PSA Population
        pop_data = parse_pop_data(html)
        if pop_data and pop_data.get("psa"):
            result["psa_pop"] = pop_data["psa"]
        
        # 2. Current prices
        prices = parse_current_prices(html)
        if prices:
            result["prices"] = prices
        
        # 3. Historical price series
        chart_data = parse_chart_data(html)
        if chart_data:
            history = {}
            for grade_key in GRADE_KEYS:
                hist = format_history(chart_data, grade_key)
                if hist:
                    history[grade_key] = hist
            result["history"] = history
        
        # 4. Save to Firestore
        if db_client and (result.get("psa_pop") or result.get("history")):
            card_id = f"{set_code}_{card_number}"
            save_to_firestore(card_id, result, db_client)
        
        # Summary
        psa10 = result.get("psa_pop", [0])[9] if result.get("psa_pop") else "N/A"
        price_psa10 = result.get("prices", {}).get("psa_10", "N/A")
        hist_points = len(result.get("history", {}).get("graded", {}))
        
        print(f"  [OK] PSA10 pop: {psa10}, psa10 price: {price_psa10}, "
              f"history: {hist_points} points")
        
        return result
        
    except Exception as e:
        print(f"  [ERROR] {e}")
        return None


def init_firestore():
    """Initialize Firestore client."""
    if not HAS_FIRESTORE:
        return None
    
    sa_path = os.environ.get("FIREBASE_ADMIN_SA_JSON")
    
    if sa_path and os.path.exists(sa_path):
        db = firestore.Client.from_service_account_json(sa_path, database=DATABASE_ID)
    elif os.path.exists(SA_FILE):
        db = firestore.Client.from_service_account_json(SA_FILE, database=DATABASE_ID)
    else:
        print("WARNING: No Firebase SA found, skipping Firestore write")
        return None
    
    return db


# ─── Card Slug Discovery ───────────────────────────────────

# Known card slugs (from PriceCharting URL structure)
KNOWN_CARDS = [
    # Format: (pricecharting_slug, set_code, card_number)
    ("pokemon-japanese-promo/armored-mewtwo-365sm-p", "sm_p", "365"),
    ("pokemon-japanese-sky-legend/mewtwo-mew-gx-097", "sm11", "097"),
    # Add more cards here...
]

# Set code → PriceCharting category hints
SET_CATEGORY_HINTS = {
    "sm11": ["pokemon-japanese-sky-legend", "pokemon-japanese-sm11"],
    "swsh6": ["pokemon-sword-shield-fusion-strike", "pokemon-sword-shield"],
    "swsh11": ["pokemon-sword-shield-vstar-universe", "pokemon-sword-shield"],
    "sm12": ["pokemon-sun-moon-cosmos-eclipse", "pokemon-sun-moon"],
    "xy9": ["pokemon-xy-fates", "pokemon-xy"],
    "bw6": ["pokemon-black-white-plasma-blitz", "pokemon-black-white"],
    "base1": ["pokemon-wizards-black-star-promos", "pokemon-base"],
    "m2": ["pokemon-x2", "pokemon-m2"],
    "sv2a": ["pokemon-scarlet-violet-prismatic-evolution", "pokemon-scarlet-violet"],
    "svp": ["pokemon-wizards-black-star-promos"],
    "sm_p": ["pokemon-japanese-promo"],
}


def generate_slug(set_code, card_number, name_en=""):
    """Generate PriceCharting URL slug from set_code + card_number."""
    categories = SET_CATEGORY_HINTS.get(set_code, ["pokemon-japanese-promo"])
    
    slugs = []
    for cat in categories:
        # Try several slug formats
        card_slug = f"{name_en.lower().replace(' ', '-').replace('&', '')}-{card_number}".strip("-")
        slugs.append(f"{cat}/{card_slug}")
    
    return slugs[0]  # Return first candidate


# ─── Main ─────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PriceCharting Historical Data Crawler")
    parser.add_argument("--limit", type=int, default=0, help="Max cards to crawl (0=all)")
    parser.add_argument("--card-file", default="", help="File with card_slug per line")
    parser.add_argument("--test", action="store_true", help="Run test on 1 card")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to Firestore")
    parser.add_argument("--slug", default="", help="Crawl a specific slug")
    args = parser.parse_args()
    
    print("=" * 60)
    print("PriceCharting Historical Data Crawler")
    print("=" * 60)
    
    db = None if args.dry_run else init_firestore()
    if db:
        print(f"Firestore: {DATABASE_ID}")
    else:
        print("Firestore: DISABLED (dry-run or no credentials)")
    
    # ── Test run ──────────────────────────────────────────
    if args.test:
        print("\n[Test Mode] Crawling Armored Mewtwo...")
        session = get_session()
        result = crawl_card(
            session,
            "pokemon-japanese-promo/armored-mewtwo-365sm-p",
            "sm_p", "365",
            db
        )
        if result:
            print(f"\nResult:")
            print(f"  PSA10: {result.get('psa_pop', [0])[9] if result.get('psa_pop') else 'N/A'}")
            print(f"  Current prices: {result.get('prices')}")
            print(f"  History grades: {list(result.get('history', {}).keys())}")
            for g, h in result.get('history', {}).items():
                if h:
                    ts_list = list(h.keys())
                    print(f"    {g}: {len(h)} points, range: {ts_list[0]} → {ts_list[-1]}")
        return
    
    # ── Slug mode ─────────────────────────────────────────
    if args.slug:
        session = get_session()
        slug = args.slug
        parts = slug.split("/")
        set_code = parts[1].split("-")[0] if len(parts) > 1 else "unknown"
        card_number = parts[1].split("-")[-1] if len(parts) > 1 else "000"
        result = crawl_card(session, slug, set_code, card_number, db)
        return
    
    # ── Card file ─────────────────────────────────────────
    if args.card_file:
        card_slugs = Path(args.card_file).read_text().strip().splitlines()
        card_slugs = [s.strip() for s in card_slugs if s.strip()]
    else:
        card_slugs = [s[0] for s in KNOWN_CARDS]
    
    if args.limit > 0:
        card_slugs = card_slugs[:args.limit]
    
    print(f"\nCards to crawl: {len(card_slugs)}")
    
    # ── Crawl loop ────────────────────────────────────────
    session = get_session()
    success = 0
    failed = 0
    
    for i, slug in enumerate(card_slugs):
        print(f"\n[{i+1}/{len(card_slugs)}] {slug}")
        
        parts = slug.split("/")
        set_code = parts[1].split("-")[0] if len(parts) > 1 else "unknown"
        card_number = parts[1].split("-")[-1] if len(parts) > 1 else "000"
        
        result = crawl_card(session, slug, set_code, card_number, db)
        
        if result:
            success += 1
        else:
            failed += 1
    
    print(f"\n{'='*60}")
    print(f"Done. Success: {success}, Failed: {failed}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()