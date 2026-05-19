#!/usr/bin/env python3
"""
pokeca-chart.com Async Price + Grading Crawler
===============================================
Asyncio + aiohttp for high-throughput crawling.
Uses semaphore for concurrency control, random delay per request to avoid ban.

Data pulled per card:
  - /ch/php/get-chart-data.php?item_id={id}   → price history (date, mint, played, psa10, volume)
  - /ch/php/get.php?function=get_item_grd_info&item_id={id}  → PSA population
  - /ch/php/get.php?function=get_shop_stock_data&item_id={id} → shop inventory

Firestore: price_history/{card_id}  (doc ID = {set_code}_{card_num}_ja)
"""

import asyncio
import json
import random
import time
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

import aiohttp
from google.cloud import firestore
from google.api_core import retry
from google.api_core.exceptions import ResourceExhausted, DeadlineExceeded

# ─── Config ───────────────────────────────────────────────────────────────────
GCP_PROJECT = "gen-lang-client-0326385388"
FIRESTORE_DB = "ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"
SA_JSON = "/home/ubuntu/tcg-invest-v3/firebase-admin-sa.json"

POKECA_BASE = "https://pokeca-chart.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://pokeca-chart.com/",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
}

# Async config
MAX_CONCURRENCY = 4       # parallel workers (each does random delay internally)
MIN_DELAY, MAX_DELAY = 1.2, 2.8  # seconds between requests per worker
REQUEST_TIMEOUT = 20       # aiohttp timeout per request

# Firestore batch size
BATCH_SIZE = 50
MAX_CONCURRENT_COMMITS = 5   # max simultaneous Firestore batch commits
RETRY_BASE_DELAY = 2          # seconds
RETRY_MAX_ATTEMPTS = 5

# ─── Firestore ────────────────────────────────────────────────────────────────
def get_firestore_client():
    return firestore.Client.from_service_account_json(SA_JSON, database=FIRESTORE_DB)

# ─── Async HTTP Client ────────────────────────────────────────────────────────
class PokecaClient:
    def __init__(self, concurrency: int = MAX_CONCURRENCY):
        self.semaphore = asyncio.Semaphore(concurrency)
        self.session: aiohttp.ClientSession | None = None
        self.total_requests = 0
        self.failed_requests = 0

    async def _get(self, url: str) -> str | None:
        """Throttled GET with random delay."""
        async with self.semaphore:
            await asyncio.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
            if self.session is None:
                return None
            try:
                async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT)) as resp:
                    self.total_requests += 1
                    if resp.status == 200:
                        return await resp.text()
                    else:
                        self.failed_requests += 1
                        return None
            except Exception:
                self.failed_requests += 1
                return None

    async def get_item_list(self, set_code: str) -> list[dict]:
        url = f"{POKECA_BASE}/ch/php/get-item-list.php?set={set_code}"
        text = await self._get(url)
        if text:
            try:
                return json.loads(text)
            except Exception:
                pass
        return []

    async def get_price_history(self, item_id: int) -> list[dict]:
        url = f"{POKECA_BASE}/ch/php/get-chart-data.php?item_id={item_id}"
        text = await self._get(url)
        if text:
            try:
                data = json.loads(text)
                # Normalize: {date, price_01, price_02, price_03, volume}
                # → {date, mint, played, psa10, volume}
                normalized = []
                for entry in data:
                    normalized.append({
                        "date": entry.get("date", ""),
                        "mint": entry.get("price_01"),
                        "played": entry.get("price_02"),
                        "psa10": entry.get("price_03"),
                        "volume": entry.get("volume", 0),
                    })
                return normalized
            except Exception:
                pass
        return []

    async def get_grading(self, item_id: int) -> dict | None:
        url = f"{POKECA_BASE}/ch/php/get.php?function=get_item_grd_info&item_id={item_id}"
        text = await self._get(url)
        if text:
            try:
                data = json.loads(text)
                if data:
                    d = data[0]
                    return {
                        "psa10": d.get("grd_status_10", 0),
                        "psa9":  d.get("grd_status_9", 0),
                        "psa8":  d.get("grd_status_8", 0),
                        "psa7":  d.get("grd_status_7", 0),
                        "psa6":  d.get("grd_status_6", 0),
                        "psa5":  d.get("grd_status_5", 0),
                        "psa4":  d.get("grd_status_4", 0),
                        "psa3":  d.get("grd_status_3", 0),
                        "psa2":  d.get("grd_status_2", 0),
                        "psa1":  d.get("grd_status_1", 0),
                        "auth":  d.get("grd_status_auth", 0),
                        "total": d.get("grd_status_all", 0),
                        "recent_price_mint": d.get("recent_price_0", ""),
                        "recent_price_psa10": d.get("recent_price_2", ""),
                        "diff_yen": d.get("diff", ""),
                        "rate_pct": d.get("rate", ""),
                        "psa_url": d.get("grd_url", ""),
                        "checked_at": d.get("checked_at", ""),
                    }
            except Exception:
                pass
        return None

    async def get_shop_stock(self, item_id: int) -> list[dict]:
        url = f"{POKECA_BASE}/ch/php/get.php?function=get_shop_stock_data&item_id={item_id}"
        text = await self._get(url)
        if text:
            try:
                data = json.loads(text)
                return [
                    {
                        "shop_id": shop.get("shop_id"),
                        "min_price": shop.get("min_price"),
                        "stock": shop.get("stock"),
                        "url": shop.get("url", ""),
                    }
                    for shop in data
                ]
            except Exception:
                pass
        return []

    async def close(self):
        if self.session:
            await self.session.close()

# ─── Card Crawl Task ──────────────────────────────────────────────────────────
async def crawl_card(client: PokecaClient, set_code: str, item: dict) -> dict | None:
    """Crawl all data for a single card. Returns doc_data or None on failure."""
    item_id = item["id"]
    slug = item.get("slug", "")
    name_jp = item.get("name", "")

    # Parse card_num from name + slug (robust, handles promos/non-cards)
    import re as _re

    def _extract(name_jp: str, slug: str) -> str:
        # EN promo: svp-en-085 → 'en-085'
        if 'en-' in slug or slug.startswith('svp-'):
            return slug.split('-', 1)[-1]

        m = _re.search(r'\[([^\]]+)\]', name_jp)
        if m:
            bracket = m.group(1).strip()
            parts = bracket.split()
            if len(parts) == 2:
                first, second = parts
                if '/' in second:
                    cp = second.split('/')[0]
                    return cp.zfill(3) if cp.isdigit() else first.zfill(3) if first.isdigit() else '000'
                return second.zfill(3) if second.isdigit() else '000'
            elif len(parts) == 1:
                single = parts[0]
                if '/' in single:
                    cp = single.split('/')[0]
                    return cp.zfill(3) if cp.isdigit() else '000'
                if single.replace('-', '').isdigit():
                    return single.zfill(3)

        # Fallback: slug
        sp = slug.split('-')
        if len(sp) >= 2:
            if sp[1].isdigit():
                return sp[1].zfill(3)
        return slug

    card_num = _extract(name_jp, slug)
    doc_id = f"{set_code}_{card_num}_ja"

    # Fetch all 3 endpoints concurrently
    price_task = client.get_price_history(item_id)
    grading_task = client.get_grading(item_id)
    shop_task = client.get_shop_stock(item_id)

    price_history, grading, shop_stock = await asyncio.gather(
        price_task, grading_task, shop_task
    )

    return {
        "doc_id": doc_id,
        "data": {
            "card_id": doc_id,
            "set_code": set_code,
            "name_jp": name_jp,
            "item_id": item_id,
            "slug": slug,
            "price_history": price_history,
            "grading": grading,
            "shop_stock": shop_stock,
            "updated_at": firestore.SERVER_TIMESTAMP,
        },
        "price_count": len(price_history),
        "psa10": grading.get("psa10") if grading else None,
    }


# ─── Set Crawl ────────────────────────────────────────────────────────────────
async def crawl_set(
    client: PokecaClient,
    set_code: str,
    db,
    batch_size: int = BATCH_SIZE,
    resume: bool = True,
    dry_run: bool = False,
) -> dict:
    """Crawl an entire set: fetch item list, crawl all cards, write to Firestore."""
    print(f"[{set_code}] Fetching item list...")
    items = await client.get_item_list(set_code)
    if not items:
        print(f"[{set_code}] ✗ No items returned")
        return {"set": set_code, "success": 0, "failed": 0, "skipped": 0}
    print(f"[{set_code}] Got {len(items)} items")

    # Build existing doc IDs for resume
    existing_ids = set()
    if resume and db:
        try:
            docs = db.collection("price_history").where("set_code", "==", set_code).stream()
            for doc in docs:
                existing_ids.add(doc.id)
        except Exception:
            pass

    # Create tasks for ALL items
    tasks = []
    for item in items:
        task = crawl_card(client, set_code, item)
        tasks.append(task)

    # Process in batches with progress reporting
    results = {"success": 0, "failed": 0, "skipped": 0}
    docs_to_write = []
    write_interval = max(batch_size, 20)

    for i, coro in enumerate(asyncio.as_completed(tasks)):
        result = await coro
        if result is None:
            results["failed"] += 1
            continue

        doc_id = result["doc_id"]

        # Skip existing if resume enabled
        if resume and doc_id in existing_ids:
            results["skipped"] += 1
            if (i + 1) % 50 == 0:
                print(f"  [progress {i+1}/{len(tasks)}] skipped={results['skipped']}")
            continue

        if dry_run:
            print(f"  [DRY] {doc_id}: price={result['price_count']}d psa10={result['psa10']}")
            results["success"] += 1
            continue

        docs_to_write.append(result)
        results["success"] += 1

        # Batch write
        if len(docs_to_write) >= batch_size:
            _flush_writes(db, docs_to_write)
            docs_to_write = []
            print(f"  [progress {i+1}/{len(tasks)}] written={results['success']} failed={results['failed']}")

    # Final flush
    if docs_to_write and not dry_run:
        _flush_writes(db, docs_to_write)

    elapsed = getattr(crawl_set, '_elapsed', '?')
    print(f"[{set_code}] ✓ done: {results['success']} ok, {results['failed']} failed, {results['skipped']} skipped")
    return {**results, "set": set_code}


def _flush_writes(db, docs: list[dict]):
    """Batch write to Firestore — non-blocking with semaphore + retry.

    Fires async commit task and returns immediately so workers keep crawling.
    """
    batch = db.batch()
    for doc in docs:
        ref = db.collection("price_history").document(doc["doc_id"])
        batch.set(ref, doc["data"], merge=True)
    asyncio.create_task(_commit_with_retry(batch, len(docs)))


_commit_sem = asyncio.Semaphore(MAX_CONCURRENT_COMMITS)

async def _commit_with_retry(batch, count: int, batch_id: int = 0):
    """Firestore batch commit with exponential backoff + semaphore."""
    async with _commit_sem:
        for attempt in range(RETRY_MAX_ATTEMPTS):
            try:
                await asyncio.get_event_loop().run_in_executor(None, batch.commit)
                return  # success
            except (ResourceExhausted, DeadlineExceeded) as e:
                if attempt == RETRY_MAX_ATTEMPTS - 1:
                    print(f"  [batch error] batch #{batch_id} FAILED after {RETRY_MAX_ATTEMPTS} attempts: {e}")
                    return
                delay = (RETRY_BASE_DELAY ** attempt) + random.uniform(0, 0.5)
                print(f"  [batch warning] #{batch_id} {e.code} — retry {attempt+1}/{RETRY_MAX_ATTEMPTS} in {delay:.1f}s")
                await asyncio.sleep(delay)
            except Exception as e:
                print(f"  [batch error] batch #{batch_id} unexpected error: {e}")
                return


# ─── Set Probe: test all set_codes in pokeca_gold ───────────────────────────
async def probe_sets(client: PokecaClient, set_codes: list[str]) -> dict[str, dict]:
    """Quick probe all set_codes to find coverage stats."""
    async def probe_one(code: str) -> tuple[str, int, int]:
        items = await client.get_item_list(code)
        # Sample one card to check if it has price data
        price_count = 0
        if items:
            first = items[0]
            ph = await client.get_price_history(first["id"])
            price_count = len(ph)
        return code, len(items), price_count

    tasks = [probe_one(code) for code in set_codes]
    results = {}
    for coro in asyncio.as_completed(tasks):
        code, item_count, price_days = await coro
        results[code] = {"items": item_count, "price_days": price_days}
        print(f"  {code}: {item_count} cards, sample price_days={price_days}")
    return results


# ─── CLI ─────────────────────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser(description="pokeca-chart.com Async Crawler")
    parser.add_argument("--set", type=str, help="Single set code (e.g. sv2a)")
    parser.add_argument("--sets-file", type=str, help="File with set codes (one per line)")
    parser.add_argument("--probe", action="store_true", help="Probe mode: test set coverage only")
    parser.add_argument("--dry-run", action="store_true", help="No Firestore writes")
    parser.add_argument("--no-resume", action="store_true", help="Re-crawl even existing docs")
    parser.add_argument("--workers", type=int, default=MAX_CONCURRENCY, help="Parallel workers")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Firestore batch size")
    parser.add_argument("--test", type=str, metavar="ITEM_ID", help="Test single item_id")
    args = parser.parse_args()

    client = PokecaClient(concurrency=args.workers)

    # Create aiohttp session
    connector = aiohttp.TCPConnector(limit=args.workers * 2, force_close=True)
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT * 3)
    client.session = aiohttp.ClientSession(connector=connector, timeout=timeout, headers=HEADERS)

    db = None if args.dry_run else get_firestore_client()

    try:
        # ── Test mode ──
        if args.test:
            item_id = int(args.test)
            print(f"[TEST] item_id={item_id}")
            ph = await client.get_price_history(item_id)
            gr = await client.get_grading(item_id)
            ss = await client.get_shop_stock(item_id)
            print(f"  Price history: {len(ph)} days")
            if ph:
                print(f"  Latest: {ph[-1]}")
            print(f"  Grading: {gr}")
            print(f"  Shop stock: {len(ss)} shops")
            return

        # ── Probe mode ──
        if args.probe:
            if args.sets_file:
                set_codes = Path(args.sets_file).read_text().strip().splitlines()
            elif args.set:
                set_codes = [args.set]
            else:
                # Auto-discover from pokeca_gold
                print("[Probe] Fetching set_codes from Firestore pokeca_gold...")
                if db is None:
                    print("ERROR: need Firestore connection for auto-discover")
                    sys.exit(1)
                docs = list(db.collection("pokeca_gold").select(["set_code"]).stream())
                from collections import Counter
                counts = Counter(d.to_dict().get("set_code", "") for d in docs)
                set_codes = sorted(counts.keys())
                print(f"Found {len(set_codes)} unique set_codes in pokeca_gold")

            print(f"[Probe] Testing {len(set_codes)} set codes...")
            results = await probe_sets(client, set_codes)
            print("\n=== Probe Results ===")
            for code, info in sorted(results.items(), key=lambda x: -x[1]["items"]):
                print(f"  {code:<12}: {info['items']:>4} cards, {info['price_days']:>4} sample price days")
            return

        # ── Normal crawl mode ──
        if args.set:
            set_codes = [args.set]
        elif args.sets_file:
            set_codes = Path(args.sets_file).read_text().strip().splitlines()
        else:
            print("Error: --set or --sets-file required")
            sys.exit(1)

        set_codes = [s.strip() for s in set_codes if s.strip()]
        resume = not args.no_resume

        total_ok = total_fail = total_skip = 0
        for set_code in set_codes:
            print(f"\n{'='*60}\nCrawling: {set_code}\n{'='*60}")
            start = time.time()
            crawl_set._elapsed = "?"
            result = await crawl_set(client, set_code, db,
                                     batch_size=args.batch_size,
                                     resume=resume,
                                     dry_run=args.dry_run)
            elapsed = time.time() - start
            crawl_set._elapsed = f"{elapsed:.0f}s"
            total_ok += result["success"]
            total_fail += result["failed"]
            total_skip += result["skipped"]

        print(f"\n{'='*60}")
        print(f"TOTAL: {total_ok} written, {total_fail} failed, {total_skip} skipped")
        print(f"Requests: {client.total_requests}, Failed: {client.failed_requests}")

    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())