#!/usr/bin/env python3
"""
psa_population_probe.py — Extract PSA population from PriceCharting using curl_cffi
Faster than Puppeteer, bypasses Cloudflare via JA3/TLS impersonation

Usage:
  python3 scripts/psa_population_probe.py
  python3 scripts/psa_population_probe.py --url "https://www.pricecharting.com/game/..."
"""

import argparse
import re
import sys
import json
from curl_cffi import requests

DEFAULT_URL = "https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p"


def fetch_page(url: str) -> tuple[str, int]:
    """Fetch PriceCharting page, return (html, status_code)."""
    resp = requests.get(url, impersonate="chrome120", timeout=30)
    return resp.text, resp.status_code


def extract_psa_data(html: str) -> dict:
    """Extract PSA 10 count, total PSA count, and percentage from HTML."""
    result = {
        "success": False,
        "psa10": None,
        "psa9": None,
        "total": None,
        "pct": None,
        "snippets": [],
    }

    # Strategy 1: Look for PSA grade tables
    # PriceCharting typically shows a table like:
    # Grade   | Population
    # PSA 10  | 142
    # PSA 9   | 891
    # Total   | 2,847

    # Find table rows
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
    for row in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.DOTALL | re.IGNORECASE)
        if len(cells) >= 2:
            label = re.sub(r'<[^>]+>', '', cells[0]).strip()
            val = re.sub(r'<[^>]+>', '', cells[1]).strip()
            if re.match(r'^PSA\s*10$', label, re.IGNORECASE):
                result["psa10"] = val
            elif re.match(r'^PSA\s*9$', label, re.IGNORECASE):
                result["psa9"] = val
            elif re.match(r'^Total', label, re.IGNORECASE):
                result["total"] = val

    # Strategy 2: Text patterns
    if not result["psa10"]:
        match = re.search(r'PSA\s*10[:\s]*([\d,]+)', html, re.IGNORECASE)
        if match:
            result["psa10"] = match.group(1)

    if not result["total"]:
        match = re.search(r'(?:Total|Census)[^0-9]*([\d,]+)', html, re.IGNORECASE)
        if match:
            result["total"] = match.group(1)

    # Strategy 3: Look for population/census sections in text
    pop_sections = re.findall(
        r'(?:Population|Census)[^<]{0,500}',
        html, re.IGNORECASE
    )
    for sec in pop_sections[:5]:
        clean = re.sub(r'<[^>]+>', '', sec).strip()
        if clean:
            result["snippets"].append(clean[:200])

    # Calculate percentage
    if result["psa10"] and result["total"]:
        try:
            p = int(result["psa10"].replace(",", ""))
            t = int(result["total"].replace(",", ""))
            if t > 0:
                result["pct"] = f"{(p/t)*100:.2f}%"
                result["success"] = True
        except ValueError:
            pass

    return result


def main():
    parser = argparse.ArgumentParser(description="PSA Population Scraper")
    parser.add_argument("--url", default=DEFAULT_URL)
    args = parser.parse_args()

    print(f"Fetching: {args.url}")
    html, status = fetch_page(args.url)
    print(f"HTTP Status: {status}")

    if status != 200:
        print(f"Failed with status {status}")
        sys.exit(1)

    data = extract_psa_data(html)

    print("\n=== PSA Population Data ===")
    print(f"Success: {data['success']}")
    print(f"PSA 10: {data['psa10']}")
    print(f"PSA 9: {data['psa9']}")
    print(f"Total: {data['total']}")
    print(f"Percentage: {data['pct']}")
    if data["snippets"]:
        print("\nSnippets:")
        for s in data["snippets"][:5]:
            print(f"  {s[:200]}")

    sys.exit(0 if data["success"] else 1)


if __name__ == "__main__":
    main()
