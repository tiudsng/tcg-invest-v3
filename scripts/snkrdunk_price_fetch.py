#!/usr/bin/env python3
"""
SNKRDUNK Price Fetcher — Playwright Direct
Uses system Playwright (via browser_navigate) to extract grade-level prices.
Output: JSON to stdout
"""

import json, sys, re

def extract_prices_from_html(html_content, url):
    """
    Given raw HTML from browser_navigate, extract grade-level prices.
    Uses regex since we don't have DOM access here.
    """
    results = {
        "url": url,
        "item_id": re.search(r'/apparels/(\d+)', url).group(1) if '/apparels/' in url else None,
        "last_sales": [],
        "current_listings": [],
        "lowest_ask": None,
        "all_grades": {}
    }
    
    # ── Pattern 1: .price class elements (Last Sales from 売買履歴) ──
    # Find all .price class occurrences with surrounding context
    price_pattern = re.compile(r'class="price"[^>]*>.*?¥([0-9,]+)', re.DOTALL)
    for match in price_pattern.finditer(html_content):
        price_str = match.group(1)
        price = int(price_str.replace(',', ''))
        
        # Get surrounding context for grade info
        start = max(0, match.start() - 200)
        end = min(len(html_content), match.end() + 100)
        context = html_content[start:end]
        
        # Extract grade
        grade = extract_grade_from_context(context)
        
        results["last_sales"].append({"grade": grade, "price_jpy": price})
        if grade != "unknown":
            results["all_grades"][grade] = price
    
    # ── Pattern 2: .item-price class (Current Listings) ──
    item_price_pattern = re.compile(r'class="item-price"[^>]*>(.*?)</[^>]+>', re.DOTALL)
    for match in item_price_pattern.finditer(html_content):
        text = match.group(1)
        price = clean_price(text)
        grade = extract_grade_from_context(text)
        
        if price and price > 0:
            results["current_listings"].append({"grade": grade, "price_jpy": price})
    
    # ── Pattern 3: Lowest Ask (.product-lowest-price) ──
    lowest_pattern = re.compile(r'class="product-lowest-price"[^>]*>([^<]*¥[0-9,]+)', re.DOTALL)
    match = lowest_pattern.search(html_content)
    if match:
        price = clean_price(match.group(1))
        results["lowest_ask"] = price
    
    return results

def clean_price(text):
    """Extract integer from text like '¥195,000' or '¥3,800~'."""
    if not text:
        return None
    nums = re.findall(r'\d+', text.replace(',', '').replace('¥', '').replace('~', ''))
    return int(''.join(nums)) if nums else None

def extract_grade_from_context(context):
    """Extract grade from surrounding HTML context."""
    grade_patterns = [
        (r'PSA10', 'PSA10'),
        (r'PSA9', 'PSA9'),
        (r'PSA8(?![以下])', 'PSA8'),
        (r'\bA\b(?![a-z])', 'A'),
        (r'\bB\b(?![a-z])', 'B'),
        (r'\bC\b(?![a-z])', 'C'),
        (r'\bD\b(?![a-z])', 'D'),
        (r'PSA8以下', 'PSA8以下'),
    ]
    for pattern, grade in grade_patterns:
        if re.search(pattern, context):
            return grade
    return "unknown"

# Read HTML from stdin (passed via browser_navigate output)
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python snkrdunk_price_fetch.py <html_file>"}))
        sys.exit(1)
    
    html_file = sys.argv[1]
    url = sys.argv[2] if len(sys.argv) > 2 else ""
    
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html = f.read()
        
        results = extract_prices_from_html(html, url)
        
        # Compute HKD conversions
        JPY_TO_HKD = 0.0512
        for grade, price in results["all_grades"].items():
            results["all_grades"][f"{grade}_hkd"] = int(price * JPY_TO_HKD)
        
        if results["lowest_ask"]:
            results["lowest_ask_hkd"] = int(results["lowest_ask"] * JPY_TO_HKD)
        
        print(json.dumps(results, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)