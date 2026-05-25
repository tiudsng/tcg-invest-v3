#!/usr/bin/env python3
"""
psa_leaderboard_sync.py
=======================
Sync PSA population data for leaderboard cards via:
  1. pokeca-chart.com get-item-id.php → get_item_grd_info API (for 5 cards)
  2. grading.pokeca-chart.com page scrape (for remaining cards)
  → Write to leaderboard/{doc_id}/market_data in Firestore

Usage:
    python3 scripts/psa_leaderboard_sync.py [--dry-run] [--force]
"""
import os
import json
import random
import re
import time
from pathlib import Path

from curl_cffi import requests as curl_requests
from google.cloud import firestore
from google.oauth2 import service_account

# ─── Config ───────────────────────────────────────────────────────────────────
FIREBASE_CRED_PATH = Path(os.environ.get(
    "FIREBASE_CRED_PATH",
    "/home/ubuntu/tcg-invest-v3/firebase-admin-sa.json"
))
PROJECT_ID     = "gen-lang-client-0326385388"
FIRESTORE_DB   = "ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"

POKECA_API     = "https://pokeca-chart.com/ch/php"
GRADING_BASE   = "https://grading.pokeca-chart.com"

FINGERPRINTS   = [
    "chrome120", "chrome119", "chrome116",
    "safari15_5",
    "edge101",
]
REQUEST_DELAY  = (1.5, 3.5)   # random seconds between requests

# ─── Leaderboard card slug mappings ──────────────────────────────────────────
# Primary: pokeca-chart.com API slug (used for get-item-id.php → get_item_grd_info)
# Fallback: grading.pokeca-chart.com page slug (direct page scrape)
#
# Strategy:
#   1. Try get-item-id.php with primary slug → if returns item_id != -1 → use API
#   2. If step 1 fails, try grading page scrape with primary slug
#   3. If page 404, try slug variations (sub-set codes like sv9a, sv5a etc.)
#   4. If all fail, write psa_pop_10=-1 as sentinel

LEADERBOARD_CARDS = [
    # rank, firestore_doc_id, primary_slug, grading_slug, name_jp
    ("rank_01", "rank_01", "svp-en-085",       "svp-en-085",      "Van Gogh Pikachu SVP 085"),
    ("rank_02", "rank_02", "s6a-095-069",       "s6a-095-069",     "Eevee Heroes 095/069"),
    ("rank_03", "rank_03", "sm-p-365",          "sm-p-365",        "Armored Mewtwo SM-P 365"),
    ("rank_04", "rank_04", "sv9-109-080",       "sv9a-109-080",    "MEGA Gengar ex SAR SV9 109"),
    ("rank_05", "rank_05", "sv9-107-080",       "sv9a-107-080",    "MEGA Charizard X ex SAR SV9 107"),
    ("rank_06", "rank_06", "sv4a-347-190",      "sv4a-347-190",    "Mew ex SV4a 347/190"),
    ("rank_07", "rank_07", "sv2a-201-165",      "sv2a-201-165",    "Charizard ex SV2a 201/165"),
    ("rank_08", "rank_08", "sv5a-191-170",      "sv5a-191-170",    "Lillie SAR SV5a 191"),
    ("rank_09", "rank_09", "sv8a-236-187",      "sv8a-236-187",    "Pikachu ex UR SV8a 236"),
    ("rank_10", "rank_10", "sv9-109-090",       "sv9a-109-090",    "Gengar ex SAR SV9 109"),
]

# Slug variations to try for SV9 / SV5a if primary slug fails
SLUG_VARIATIONS = {
    "sv9a-109-080": ["sv9b-109-080", "sv9c-109-080", "sv9-109-080", "sv09-109-080"],
    "sv9a-107-080": ["sv9b-107-080", "sv9c-107-080", "sv9-107-080", "sv09-107-080"],
    "sv9a-109-090": ["sv9b-109-090", "sv9c-109-090", "sv9-109-090", "sv09-109-090"],
    "sv5a-191-170": ["sv5a-191", "sv5-191-170", "sm12a-191-173", "sv5-191-173"],
    "sm-p-365":     ["smp-365", "sm-p-0365", "sm35-365", "sm-p-365-sm-p"],
}

# ─── Firestore Init ────────────────────────────────────────────────────────────
def init_firestore():
    creds_dict = json.loads(Path(FIREBASE_CRED_PATH).read_text())
    creds = service_account.Credentials.from_service_account_info(creds_dict)
    return firestore.Client(credentials=creds, project=PROJECT_ID, database=FIRESTORE_DB)

db = init_firestore()

# ─── HTTP helpers ─────────────────────────────────────────────────────────────
def make_request(method, url, **kwargs):
    """Make HTTP request with fingerprint rotation + delay."""
    fp = random.choice(FINGERPRINTS)
    kwargs.setdefault("impersonate", fp)
    kwargs.setdefault("timeout", 20)
    time.sleep(random.uniform(*REQUEST_DELAY))
    return curl_requests.request(method, url, **kwargs)

# ─── PSA Data Fetchers ────────────────────────────────────────────────────────
def get_item_id(slug: str) -> int | None:
    """Call get-item-id.php to map slug → item_id."""
    url = f"{POKECA_API}/get-item-id.php?slug={slug}"
    resp = make_request("GET", url,
        headers={"Referer": "https://pokeca-chart.com/", "Accept-Language": "en-US,en;q=0.9"})
    try:
        data = resp.json()
        return data if isinstance(data, int) and data != -1 else None
    except:
        return None

def get_psa_via_api(item_id: int) -> dict | None:
    """Get PSA population via get_item_grd_info API."""
    url = f"{POKECA_API}/get.php?function=get_item_grd_info&item_id={item_id}"
    resp = make_request("GET", url,
        headers={"Referer": "https://pokeca-chart.com/", "Accept-Language": "en-US,en;q=0.9"})
    try:
        data = resp.json()
        if data and isinstance(data, list) and len(data) > 0:
            d = data[0]
            return {
                "psa_pop_10":      d.get("grd_status_10", 0),
                "psa_pop_9":       d.get("grd_status_9", 0),
                "psa_pop_8":       d.get("grd_status_8", 0),
                "psa_pop_total":   d.get("grd_status_all", 0),
                "psa_pop_source":  "api",
                "psa_pop_updated": d.get("checked_at", ""),
                "psa_pop_item_id": item_id,
            }
    except:
        pass
    return None

def get_psa_via_grading_page(slug: str) -> dict | None:
    """Scrape PSA population from grading.pokeca-chart.com/{slug}/ page."""
    url = f"{GRADING_BASE}/{slug}/"
    resp = make_request("GET", url,
        headers={"Referer": GRADING_BASE + "/", "Accept-Language": "ja,en-US;q=0.7"})
    if resp.status_code != 200 or "PSA分布表" not in resp.text:
        return None

    # Parse table: AUTH | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | ALL | date
    cells = re.findall(r"<td[^>]*>([\d,]+)</td>", resp.text)
    if cells and len(cells) >= 12:
        return {
            "psa_pop_10":      int(cells[10].replace(",", "")),
            "psa_pop_9":       int(cells[9].replace(",", "")),
            "psa_pop_8":       int(cells[8].replace(",", "")),
            "psa_pop_total":   int(cells[11].replace(",", "")),
            "psa_pop_source":  "grading_page",
            "psa_pop_updated": cells[12] if len(cells) > 12 else "",
            "psa_pop_slug":    slug,
        }
    return None

# ─── Main Sync Logic ───────────────────────────────────────────────────────────
def sync_card(rank, doc_id, primary_slug, grading_slug, name_jp, dry_run=False, force=False):
    """Sync PSA data for one leaderboard card. Returns result dict."""
    result = {
        "rank": rank, "doc_id": doc_id,
        "primary_slug": primary_slug, "grading_slug": grading_slug,
        "status": "unknown", "psa_pop_10": None, "psa_pop_total": None,
        "method": None, "item_id": None, "error": None,
    }

    # Check existing data (skip if already populated and not forced)
    if not force:
        doc = db.collection("leaderboard").document(doc_id).get()
        if doc.exists:
            existing_md = doc.to_dict().get("market_data", {})
            if existing_md.get("psa_pop_10") and existing_md.get("psa_pop_10") > 0:
                result["status"] = "already_populated"
                result["psa_pop_10"] = existing_md.get("psa_pop_10")
                result["psa_pop_total"] = existing_md.get("psa_pop_total")
                return result

    # ── Step 1: Try API (get-item-id → get_item_grd_info) ─────────────────────
    item_id = get_item_id(primary_slug)
    if item_id:
        psa_data = get_psa_via_api(item_id)
        if psa_data:
            result["status"] = "success"
            result["psa_pop_10"] = psa_data["psa_pop_10"]
            result["psa_pop_total"] = psa_data["psa_pop_total"]
            result["method"] = "api"
            result["item_id"] = item_id
            psa_data["psa_pop_rank"] = rank
            psa_data["synced_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            if dry_run:
                print(f"  [DRY RUN] Would write to leaderboard/{doc_id}: PSA10={psa_data['psa_pop_10']:,}")
            else:
                db.collection("leaderboard").document(doc_id).set(
                    {"market_data": psa_data}, merge=True
                )
                print(f"  ✅ {rank} | {primary_slug} → item_id={item_id} PSA10={psa_data['psa_pop_10']:,} (API)")
            return result

    # ── Step 2: Try grading page scrape ───────────────────────────────────────
    psa_data = get_psa_via_grading_page(grading_slug)
    if psa_data:
        result["status"] = "success"
        result["psa_pop_10"] = psa_data["psa_pop_10"]
        result["psa_pop_total"] = psa_data["psa_pop_total"]
        result["method"] = "grading_page"
        psa_data["psa_pop_rank"] = rank
        psa_data["synced_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

        if dry_run:
            print(f"  [DRY RUN] Would write to leaderboard/{doc_id}: PSA10={psa_data['psa_pop_10']:,}")
        else:
            db.collection("leaderboard").document(doc_id).set(
                {"market_data": psa_data}, merge=True
            )
            print(f"  ✅ {rank} | {grading_slug} → PSA10={psa_data['psa_pop_10']:,} (grading page)")
        return result

    # ── Step 3: Try slug variations ───────────────────────────────────────────
    if primary_slug in SLUG_VARIATIONS:
        for slug_var in SLUG_VARIATIONS[primary_slug]:
            # Try API
            item_id2 = get_item_id(slug_var)
            if item_id2:
                psa_data = get_psa_via_api(item_id2)
                if psa_data:
                    result["status"] = "success"
                    result["psa_pop_10"] = psa_data["psa_pop_10"]
                    result["psa_pop_total"] = psa_data["psa_pop_total"]
                    result["method"] = f"api (var: {slug_var})"
                    result["item_id"] = item_id2
                    psa_data["psa_pop_rank"] = rank
                    psa_data["synced_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
                    if not dry_run:
                        db.collection("leaderboard").document(doc_id).set(
                            {"market_data": psa_data}, merge=True
                        )
                    print(f"  ✅ {rank} | {slug_var} → PSA10={psa_data['psa_pop_10']:,} (API, varied slug)")
                    return result

            # Try grading page
            psa_data2 = get_psa_via_grading_page(slug_var)
            if psa_data2:
                result["status"] = "success"
                result["psa_pop_10"] = psa_data2["psa_pop_10"]
                result["psa_pop_total"] = psa_data2["psa_pop_total"]
                result["method"] = f"grading_page (var: {slug_var})"
                psa_data2["psa_pop_rank"] = rank
                psa_data2["synced_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
                if not dry_run:
                    db.collection("leaderboard").document(doc_id).set(
                        {"market_data": psa_data2}, merge=True
                    )
                print(f"  ✅ {rank} | {slug_var} → PSA10={psa_data2['psa_pop_10']:,} (grading page, varied slug)")
                return result

    # ── Step 4: All failed → write sentinel ───────────────────────────────────
    result["status"] = "failed"
    result["method"] = "none"
    result["psa_pop_10"] = -1
    result["psa_pop_total"] = -1
    result["error"] = "slug_not_found"
    sentinel = {
        "psa_pop_10": -1, "psa_pop_9": -1, "psa_pop_8": -1,
        "psa_pop_total": -1, "psa_pop_source": "failed",
        "psa_pop_rank": rank, "psa_pop_updated": "",
        "synced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if not dry_run:
        db.collection("leaderboard").document(doc_id).set(
            {"market_data": sentinel}, merge=True
        )
    print(f"  ❌ {rank} | primary={primary_slug} grading={grading_slug} → ALL METHODS FAILED")
    return result

# ─── CLI Entry Point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync PSA population to leaderboard docs")
    parser.add_argument("--dry-run", action="store_true", help="Print only, don't write Firestore")
    parser.add_argument("--force", action="store_true", help="Overwrite existing data")
    parser.add_argument("--rank", help="Sync specific rank only (e.g. rank_03)")
    args = parser.parse_args()

    print("=" * 60)
    print("PSA Leaderboard Sync")
    print(f"  Dry run: {args.dry_run}")
    print(f"  Force:   {args.force}")
    print("=" * 60)

    results = []
    for rank, doc_id, primary_slug, grading_slug, name_jp in LEADERBOARD_CARDS:
        if args.rank and args.rank != rank:
            continue
        print(f"\nProcessing {rank}: {name_jp}")
        r = sync_card(rank, doc_id, primary_slug, grading_slug, name_jp,
                      dry_run=args.dry_run, force=args.force)
        results.append(r)

    # Summary
    ok = [r for r in results if r["status"] == "success"]
    fail = [r for r in results if r["status"] == "failed"]
    skip = [r for r in results if r["status"] == "already_populated"]
    print(f"\n{'='*60}")
    print(f"Results: {len(ok)} ✅  {len(fail)} ❌  {len(skip)} ⏭ already populated")
    for r in results:
        print(f"  {r['rank']} | {r['method'] or 'none':<30} | PSA10={r['psa_pop_10']}")