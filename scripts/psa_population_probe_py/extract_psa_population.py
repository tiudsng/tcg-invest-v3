#!/usr/bin/env python3
"""
PSA Population Extractor for PriceCharting
Uses curl_cffi (no Puppeteer needed!)

Data format discovered:
  VGPC.pop_data = {"psa":[86,98,252,725,1164,1761,1318,1708,2219,3792]}
  Index:         Grade:  1   2   3   4   5   6    7    8    9   10
  psa[0]=86 → PSA 1, psa[9]=3792 → PSA 10

Usage:
  python3 scripts/psa_population_probe_py/extract_psa_population.py
  python3 scripts/psa_population_probe_py/extract_psa_population.py --url "https://www.pricecharting.com/game/..."
  python3 scripts/psa_population_probe_py/extract_psa_population.py --url "..." --format json
"""

import argparse
import re
import sys
import json
from curl_cffi import requests

DEFAULT_URL = "https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p"
IMPERSONATE = "chrome120"


def fetch_page(url: str) -> tuple[str, int]:
    resp = requests.get(
        url,
        impersonate=IMPERSONATE,
        timeout=30,
        headers={
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.pricecharting.com/",
        }
    )
    return resp.text, resp.status_code


def extract_psa_population(html: str) -> dict:
    """Extract PSA population data from PriceCharting HTML."""
    result = {
        "success": False,
        "psa10": None,
        "psa9": None,
        "psa10_pct": None,
        "total": None,
        "price_usd": None,
        "raw": None,
    }

    # Strategy 1: Extract psa array from VGPC.pop_data directly
    # Format: VGPC.pop_data = {"psa":[86,98,252,...],"cgc":[...]}
    psa_match = re.search(r'"psa":\s*\[([\d,]+)\]', html)
    if psa_match:
        try:
            psa = [int(x) for x in psa_match.group(1).split(',')]
            if len(psa) == 10:
                result["psa9"] = psa[8]    # PSA 9
                result["psa10"] = psa[9]   # PSA 10
                result["total"] = sum(psa)
                result["success"] = True
                result["raw"] = f"psa array: {psa}"
        except ValueError:
            pass

    # Strategy 2: Fallback - extract VGPC.pop_data full object
    if not result["success"]:
        pop_match = re.search(r'VGPC\.pop_data\s*=\s*(\{[^}]+\})', html)
        if pop_match:
            result["raw"] = pop_match.group(1)[:200]

    # Strategy 2: Fallback - look for pop_data with different variable name
    if not result["success"]:
        pop_match2 = re.search(
            r'\.pop_data\s*=\s*(\{"[^}]+\})',
            html
        )
        if pop_match2:
            result["raw"] = pop_match2.group(0)[:200]

    # Strategy 3: Price extraction (PSA 10 price in USD)
    price_match = re.search(r'\$\s*([0-9,]+\.?\d*)', html)
    if price_match:
        result["price_usd"] = price_match.group(0)

    # Calculate percentage
    if result["psa10"] and result["total"]:
        try:
            p10 = int(result["psa10"])
            total = int(result["total"])
            if total > 0:
                result["psa10_pct"] = f"{(p10 / total * 100):.2f}%"
        except (ValueError, TypeError):
            pass

    return result


def main():
    parser = argparse.ArgumentParser(description="PSA Population Extractor")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--format", default="text", choices=["text", "json"])
    args = parser.parse_args()

    print(f"Fetching: {args.url}", file=sys.stderr)
    html, status = fetch_page(args.url)

    if status != 200:
        print(f"HTTP {status}", file=sys.stderr)
        sys.exit(1)

    data = extract_psa_population(html)

    if args.format == "json":
        print(json.dumps(data, indent=2))
    else:
        print("\n=== PSA Population Data ===")
        print(f"Success: {data['success']}")
        print(f"PSA 10 population: {data['psa10']}")
        print(f"PSA 9 population:  {data['psa9']}")
        print(f"Total PSA:        {data['total']}")
        print(f"PSA 10 %%:         {data['psa10_pct']}")
        print(f"Price (USD):      {data['price_usd']}")
        print(f"Raw source:       {data['raw']}")

    sys.exit(0 if data["success"] else 1)


if __name__ == "__main__":
    main()
