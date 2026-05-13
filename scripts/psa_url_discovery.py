#!/usr/bin/env python3
"""
PSA URL Discovery v2 — Find correct PriceCharting URL + Extract PSA data
=========================================================================
CVM IP blocked; runs on GitHub Actions runner.
"""
import re
import sys
from curl_cffi import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def extract_psa_data(html: str) -> dict:
    """Extract PSA population data from PriceCharting HTML."""
    # Try multiple regex patterns for VGPC.pop_data
    patterns = [
        # Pattern 1: Full object with psa array
        r'VGPC\.pop_data\s*=\s*\{[^}]*?psa:\s*\[([^\]]+)\]',
        # Pattern 2: Simple psa array assignment
        r'"psa":\s*\[([^\]]+)\]',
        # Pattern 3: Just look for the array content
        r'psa:\s*\[([\d,]+)\]',
    ]
    
    for i, pat in enumerate(patterns):
        m = re.search(pat, html)
        if m:
            vals = [int(x) for x in m.group(1).split(",")]
            if len(vals) == 10:
                total = sum(vals)
                psa10 = vals[9]
                gem_rate = round(psa10 / total * 100, 2) if total > 0 else 0
                return {
                    "psa": vals,
                    "total": total,
                    "psa10": psa10,
                    "psa9": vals[8] if len(vals) > 8 else 0,
                    "gem_mt_rate": gem_rate,
                    "pattern": i
                }
    return None

def try_url(url: str) -> dict:
    """Try fetching a URL."""
    try:
        resp = requests.get(url, headers=HEADERS, impersonate="chrome", timeout=15)
        if resp.status_code == 200:
            title_m = re.search(r'<title>([^<]+)</title>', resp.text)
            title = title_m.group(1) if title_m else "Unknown"
            
            # Check for "No population data" or other indicators
            has_psa = "psa" in resp.text.lower() or "population" in resp.text.lower()
            
            psa = extract_psa_data(resp.text)
            
            return {
                "status": 200,
                "url": url,
                "title": title,
                "has_psa": has_psa,
                "psa_data": psa,
            }
        else:
            return {"status": resp.status_code, "url": url}
    except Exception as e:
        return {"status": "ERROR", "url": url, "error": str(e)[:100]}

def get_url_candidates(set_code: str, card_number: str, name_jp: str = "") -> list:
    """Generate candidate URLs for a card."""
    # Normalize name for slug
    name_slug = name_jp.replace(" ", "-").replace("&", "-").replace(":", "").lower()
    name_slug_encoded = name_jp.replace(" ", "-").replace("&", "%26").lower()
    
    # Extract romanized keywords from name_jp
    keywords = []
    if "ミュウツー" in name_jp or "Mewtwo" in name_jp:
        keywords.append("mewtwo")
    if "ミュウ" in name_jp or "Mew" in name_jp:
        keywords.append("mew")
    
    candidates = []
    
    # Category patterns for sm11 (Sky Legend / Miracle Twins)
    categories = [
        "pokemon-japanese-sky-legend",
        "pokemon-japanese-sm11",
        "pokemon-sun-moon-promos",
        "pokemon-japanese-miracle-twins",
        "pokemon-miracle-twins",
    ]
    
    slug_variants = [
        f"mewtwo-mew-gx-{card_number}",
        f"mewtwo-mew-gx-{card_number.lstrip('0')}",
        f"mewtwo-%26-mew-gx-{card_number}",
        f"mewtwo-and-mew-gx-{card_number}",
    ]
    
    for cat in categories:
        for slug in slug_variants:
            candidates.append(f"https://www.pricecharting.com/game/{cat}/{slug}")
    
    return candidates

def discover(set_code: str, card_number: str, name_jp: str = ""):
    """Main discovery logic."""
    candidates = get_url_candidates(set_code, card_number, name_jp)
    print(f"Testing {len(candidates)} URL patterns for {set_code}_{card_number}...")
    
    best_result = None
    
    for url in candidates:
        result = try_url(url)
        if result["status"] == 200:
            has_psa_content = result.get("has_psa", False)
            psa = result.get("psa_data")
            
            print(f"  200 [{result['title'][:50]}] PSA={bool(psa)} - {url}")
            
            if psa and best_result is None:
                # Found PSA data - this is our best result
                print(f"\n✅ BEST: {url}")
                print(f"   Title: {result['title']}")
                print(f"   PSA10={psa['psa10']}, PSA9={psa['psa9']}, Total={psa['total']}, Gem={psa['gem_mt_rate']}%")
                best_result = result
                break
            elif psa is None and best_result is None:
                # URL works but no PSA data - keep looking
                print(f"   [No PSA data on this page]")
    
    return best_result

if __name__ == "__main__":
    set_code = sys.argv[1] if len(sys.argv) > 1 else "sm11"
    card_number = sys.argv[2] if len(sys.argv) > 2 else "097"
    name_jp = sys.argv[3] if len(sys.argv) > 3 else "ミュウツー&ミュウGX SR"
    
    result = discover(set_code, card_number, name_jp)
    
    if result:
        print(f"\n🎯 Confirmed URL: {result['url']}")
        print(f"📊 PSA Data: {result['psa_data']}")
        sys.exit(0)
    else:
        print("\n❌ Could not find working URL with PSA data")
        sys.exit(1)
