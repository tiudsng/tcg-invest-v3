#!/usr/bin/env python3
"""
PSA URL Discovery — Find correct PriceCharting URL for a card
==============================================================
Uses curl_cffi with Chrome impersonation to probe URL patterns.
CVM IP is blocked; this runs on GitHub Actions runner.
"""
import re
import sys
from curl_cffi import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def try_url(url: str) -> dict:
    """Try fetching a URL, return status + PSA data if found."""
    try:
        resp = requests.get(url, headers=HEADERS, impersonate="chrome", timeout=15)
        if resp.status_code == 200:
            # Extract PSA population
            m = re.search(r'VGPC\.pop_data\s*=\s*\{[^}]*psa:\s*\[([^\]]+)\]', resp.text)
            # Extract page title
            title_m = re.search(r'<title>([^<]+)</title>', resp.text)
            title = title_m.group(1) if title_m else "Unknown"
            
            return {
                "status": 200,
                "url": url,
                "title": title,
                "psa_raw": m.group(1) if m else None,
            }
        else:
            return {"status": resp.status_code, "url": url}
    except Exception as e:
        return {"status": "ERROR", "url": url, "error": str(e)[:50]}

def discover_sm11_097():
    """Try multiple URL patterns for sm11 097 ミュウツー&ミュウGX SR"""
    
    # Candidate URLs — various patterns based on known working URLs
    candidates = [
        # Category: pokemon-japanese-sky-legend (sm11 = Sky Legend)
        "https://www.pricecharting.com/game/pokemon-japanese-sky-legend/mewtwo-mew-gx-097",
        "https://www.pricecharting.com/game/pokemon-japanese-sky-legend/mewtwo-%26-mew-gx-097",
        "https://www.pricecharting.com/game/pokemon-japanese-sky-legend/mewtwo-and-mew-gx-097",
        # Category: pokemon-japanese-sm11
        "https://www.pricecharting.com/game/pokemon-japanese-sm11/mewtwo-mew-gx-097",
        "https://www.pricecharting.com/game/pokemon-japanese-sm11/mewtwo-%26-mew-gx-097",
        # Category: pokemon-sun-moon-promos
        "https://www.pricecharting.com/game/pokemon-sun-moon-promos/mewtwo-mew-gx-097",
        "https://www.pricecharting.com/game/pokemon-sun-moon-promos/mewtwo-%26-mew-gx-097",
        # Category: pokemon-japanese-promo (for SR promos)
        "https://www.pricecharting.com/game/pokemon-japanese-promo/mewtwo-mew-gx-097",
        "https://www.pricecharting.com/game/pokemon-japanese-promo/mewtwo-%26-mew-gx-sr-097",
    ]
    
    print(f"Testing {len(candidates)} URL patterns for sm11_097...")
    
    for url in candidates:
        result = try_url(url)
        if result["status"] == 200:
            print(f"\n✅ SUCCESS: {url}")
            print(f"   Title: {result['title']}")
            if result.get("psa_raw"):
                psa_vals = [int(x) for x in result["psa_raw"].split(",")]
                total = sum(psa_vals)
                psa10 = psa_vals[9] if len(psa_vals) > 9 else 0
                gem_rate = round(psa10 / total * 100, 2) if total > 0 else 0
                print(f"   PSA data: {psa_vals}")
                print(f"   PSA10={psa10}, Total={total}, GemRate={gem_rate}%")
                return result
        else:
            print(f"   {result['status']} — {url}")
    
    print("\n❌ No working URL found")
    return None

if __name__ == "__main__":
    result = discover_sm11_097()
    if result:
        print(f"\n🎯 Final URL: {result['url']}")
        sys.exit(0)
    else:
        sys.exit(1)