#!/usr/bin/env python3
"""
psa_population_probe.py — Extract PSA population from PriceCharting using curl_cffi
Use browser UA to get JS-rendered content, then extract population data.

Usage:
  python3 scripts/psa_population_probe_py/extract_psa_population.py
  python3 scripts/psa_population_probe_py/extract_psa_population.py --url "https://www.pricecharting.com/game/..."
"""

import argparse
import re
import sys
import json
from curl_cffi import requests

DEFAULT_URL = "https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p"


def fetch_page(url: str) -> tuple[str, int]:
    """Fetch PriceCharting page with Chrome UA."""
    resp = requests.get(
        url,
        impersonate="chrome120",
        timeout=30,
        headers={
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.pricecharting.com/",
        }
    )
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
        "price_usd": None,
    }

    # Strategy 1: Price (PSA 10 price in USD - we know this exists)
    price_match = re.search(r'\$([0-9,]+\.?\d*)', html)
    if price_match:
        result["price_usd"] = price_match.group(0)
        result["snippets"].append(f"Price found: {result['price_usd']}")

    # Strategy 2: Look for inline JSON in script tags (common for chart data)
    # Look for population data in JSON format
    json_patterns = [
        r'population["\s:]+(\d+)',
        r'psa10["\s:]+(\d+)',
        r'psa9["\s:]+(\d+)',
        r'"total"[^}]*?(\d+)',
        r'Census[^0-9]*?(\d+)',
    ]
    for pat in json_patterns:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            result["snippets"].append(f"JSON pattern '{pat}': {m.group(0)}")

    # Strategy 3: Look for data in specific divs or attributes
    data_attrs = re.findall(r'data-(?:population|psa|grade|census)[=\s]["\']([^"\']{1,100})["\']', html, re.IGNORECASE)
    for d in data_attrs[:5]:
        result["snippets"].append(f"data-attr: {d}")

    # Strategy 4: Look for JavaScript variables with population data
    js_vars = re.findall(r'(?:var|const|let)\s+\w*(?:population|psa|census)\w*\s*=\s*([^;]{1,200})', html, re.IGNORECASE)
    for v in js_vars[:5]:
        result["snippets"].append(f"JS var: {v[:150]}")

    # Strategy 5: Find population table in HTML
    table_match = re.search(r'<table[^>]*class="[^"]*population[^"]*"[^>]*>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    if table_match:
        result["snippets"].append(f"Population table: {table_match.group(0)[:300]}")

    # Strategy 6: Look for chart config with population data
    chart_configs = re.findall(r'(?:population|census|psa[^0-9]*?\d{2,})', html, re.IGNORECASE)
    if chart_configs:
        result["snippets"].append(f"Chart configs found: {chart_configs[:10]}")

    # Strategy 7: Find all numbers that look like population counts (3-7 digits)
    # near population-related keywords
    lines_with_pop = []
    for line in html.split('\n'):
        if re.search(r'(?:population|census|psa|grade)', line, re.IGNORECASE):
            nums = re.findall(r'\b(\d{3,7})\b', line)
            if nums:
                lines_with_pop.append(f"{line.strip()[:200]} -> {nums}")

    for lp in lines_with_pop[:10]:
        result["snippets"].append(f"POP_LINE: {lp}")

    # Strategy 8: Try to find the API call that PriceCharting makes
    # Usually it's something like /api/market-data or /api/population
    api_patterns = [
        r'["\'](/api/[^"\']+)["\']',
        r'fetch\(["\']([^"\']+)["\']',
        r'\.get\(["\']([^"\']+population[^"\']+)["\']',
    ]
    for pat in api_patterns:
        matches = re.findall(pat, html, re.IGNORECASE)
        for m in matches[:5]:
            result["snippets"].append(f"API candidate: {m}")

    # Strategy 9: Look for URL patterns in JavaScript
    url_patterns = re.findall(r'["\']([^"\']*?(?:api|market|population|psa)[^"\']{0,100})["\']', html, re.IGNORECASE)
    for up in url_patterns[:10]:
        if len(up) < 200:
            result["snippets"].append(f"URL pattern: {up}")

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

    print("\n=== Results ===")
    print(f"Success: {data['success']}")
    print(f"Price USD: {data['price_usd']}")
    print(f"PSA 10: {data['psa10']}")
    print(f"PSA 9: {data['psa9']}")
    print(f"Total: {data['total']}")
    print(f"Percentage: {data['pct']}")
    if data["snippets"]:
        print(f"\nSnippets ({len(data['snippets'])}):")
        for s in data["snippets"][:30]:
            print(f"  {s[:200]}")

    sys.exit(0 if data["success"] else 0)  # Always exit 0 for probe


if __name__ == "__main__":
    main()
