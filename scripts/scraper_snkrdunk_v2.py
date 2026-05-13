#!/usr/bin/env python3
"""
scraper_snkrdunk_v2.py — SNKRDUNK Browser Automation Scraper
Armored Mewtwo Edition: JP-HK Premium Radar v1.0
Author: Hermès Agent (小籠包) x 小龍蝦
Date: 2026-05-12
"""

import re
import json
import time
import random
import subprocess
import sys
import os
from datetime import datetime, timezone

# ── Third-party ──────────────────────────────────────────────────────────────
try:
    from scrapling import StealthyFetcher
except ImportError:
    print("[ERROR] scrapling not installed. Run: pip install scrapling")
    sys.exit(1)

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("[ERROR] firebase-admin not installed. Run: pip install firebase-admin")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("[ERROR] requests not installed. Run: pip install requests")
    sys.exit(1)

# ── Constants ─────────────────────────────────────────────────────────────────
SNKRDUNK_BASE = "https://snkrdunk.com"
PROXY_URL     = "http://127.0.0.1:18765"   # Herman Proxy (curl_cffi)
HERMAN_PROXY  = True                        # Set False to use direct HTTPS

# JPY → HKD conversion (approximate, update daily)
JPY_TO_HKD    = 0.0512

# Grade priority for price extraction (highest → lowest trust)
GRADE_PRIORITY = ["PSA10", "PSA9", "PSA8", "A", "B", "C", "D"]

# Random delay between requests (seconds)
MIN_DELAY      = 3
MAX_DELAY      = 8

# ── Firebase Setup ─────────────────────────────────────────────────────────────
def init_firebase():
    """Initialize Firebase with environment variable credentials."""
    cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
    elif cred_path:
        # Inline JSON string
        try:
            cred_dict = json.loads(cred_path)
            cred = credentials.Certificate(cred_dict)
        except json.JSONDecodeError:
            # Try as file path
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                raise ValueError(f"Invalid FIREBASE_SERVICE_ACCOUNT_JSON: {cred_path[:50]}...")
    else:
        # Check default paths
        default_paths = [
            "/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json",
            os.path.expanduser("~/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json"),
        ]
        for p in default_paths:
            if os.path.exists(p):
                cred = credentials.Certificate(p)
                break
        else:
            raise FileNotFoundError("No Firebase credentials found")
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    return firestore.client()

# ── Browser Fetcher ───────────────────────────────────────────────────────────
class SnkrdunkBrowser:
    """
    Browser automation using Scrapling's StealthyFetcher.
    Handles Cloudflare Turnstile bypass and JS rendering.
    """
    
    def __init__(self, use_proxy=True):
        self.use_proxy = use_proxy
        # Configure stealth mode
        StealthyFetcher.configure(
            browser="chromium",
            headless=True,
            locale="ja-JP"
        )
        
        # Initialize stealth session
        self.fetcher = StealthyFetcher()
        
        # Turnstile click coordinates (from _stealth.py analysis)
        self.turnstile_x = random.randint(26, 28)
        self.turnstile_y = random.randint(25, 27)
    
    def _build_proxies(self):
        if self.use_proxy and PROXY_URL:
            return {
                "http":  PROXY_URL,
                "https": PROXY_URL,
            }
        return {}
    
    def get_page(self, url, timeout=45):
        """
        Fetch a SNKRDUNK page with stealth browser automation.
        Handles Cloudflare and JS rendering automatically.
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "ja-JP,ja;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        
        try:
            page = self.fetcher.fetch(
                url,
                proxies=self._build_proxies() if self.use_proxy else {},
                headers=headers,
                timeout=timeout
            )
            return page
        except Exception as e:
            print(f"  [WARN] Fetch failed ({url}): {e}")
            return None
    
    def extract_prices_from_page(self, page):
        """
        Extract all grade-level prices from SNKRDUNK item page.
        
        Returns dict:
            {
                "last_sales":    [(grade, price_jpy), ...],
                "current_listings": [(grade, price_jpy), ...],
                "lowest_ask":     price_jpy or None,
                "all_grades":     {grade: price_jpy, ...}
            }
        """
        if not page:
            return None
        
        results = {
            "last_sales":       [],
            "current_listings": [],
            "lowest_ask":       None,
            "all_grades":       {}
        }
        
        # ── Method 1: .price class (Last Sales from 売買履歴) ──
        try:
            price_elements = page.css(".price")
            for el in price_elements:
                text = el.text.strip()
                price = self._clean_price(text)
                grade = self._extract_grade(text)
                if price and price > 0:
                    results["last_sales"].append((grade, price))
                    if grade and grade != "unknown":
                        results["all_grades"][grade] = price
        except Exception as e:
            print(f"  [WARN] .price extraction failed: {e}")
        
        # ── Method 2: .item-price class (Current Listings from 出品一覧) ──
        try:
            listing_elements = page.css(".item-price")
            for el in listing_elements:
                text = el.text.strip()
                price = self._clean_price(text)
                grade = self._extract_grade(text)
                if price and price > 0:
                    results["current_listings"].append((grade, price))
        except Exception as e:
            print(f"  [WARN] .item-price extraction failed: {e}")
        
        # ── Method 3: Lowest Ask (.product-lowest-price) ──
        try:
            lowest_el = page.css(".product-lowest-price")
            if lowest_el:
                text = lowest_el[0].text.strip()
                price = self._clean_price(text)
                if price and price > 0:
                    results["lowest_ask"] = price
        except Exception:
            pass
        
        return results
    
    def _clean_price(self, text):
        """Extract integer price from text like '¥195,000' or '¥3,800~'."""
        if not text:
            return None
        # Remove ¥,~,comma, spaces
        nums = re.findall(r'\d+', text.replace(',', '').replace('¥', '').replace('~', ''))
        if nums:
            return int(''.join(nums))
        return None
    
    def _extract_grade(self, text):
        """Extract grade from price text like '¥39,980 A' or 'PSA10'."""
        if not text:
            return "unknown"
        
        # Priority order for matching
        grade_patterns = [
            (r'PSA10', 'PSA10'),
            (r'PSA9',  'PSA9'),
            (r'PSA8',  'PSA8'),
            (r'\bA\b', 'A'),
            (r'\bB\b', 'B'),
            (r'\bC\b', 'C'),
            (r'\bD\b', 'D'),
            (r'PSA8以下', 'PSA8以下'),
        ]
        
        for pattern, grade in grade_patterns:
            if re.search(pattern, text):
                return grade
        
        return "unknown"

# ── Search Engine: Keyword → Item ID ─────────────────────────────────────────
class SnkrdunkSearchEngine:
    """
    Discovers item_ids from search keywords using browser automation.
    Since SNKRDUNK search results are JS-rendered, we need browser automation.
    """
    
    def __init__(self, browser):
        self.browser = browser
    
    def search(self, keyword, max_results=10):
        """
        Search SNKRDUNK and return list of (item_id, title, price) tuples.
        """
        # URL encode the search query
        encoded_query = requests.utils.quote(keyword)
        search_url = f"{SNKRDUNK_BASE}/search?q={encoded_query}"
        
        print(f"  [SEARCH] {search_url}")
        
        page = self.browser.get_page(search_url)
        if not page:
            print(f"  [ERROR] Search page fetch failed")
            return []
        
        # Wait for JS rendering (Scrapling handles this automatically)
        time.sleep(2)  # Extra wait for dynamic content
        
        results = []
        
        try:
            # Find all /apparels/{id} links with prices
            all_links = page.css("a[href]")
            
            seen_ids = set()
            
            for link in all_links:
                try:
                    href = link.get_attribute("href") or ""
                    text = link.text.strip() or ""
                    
                    if '/apparels/' not in href:
                        continue
                    
                    # Extract item_id from href like /apparels/107574 or /apparels/107574/used/...
                    id_match = re.search(r'/apparels/(\d+)', href)
                    if not id_match:
                        continue
                    
                    item_id = id_match.group(1)
                    if item_id in seen_ids:
                        continue
                    seen_ids.add(item_id)
                    
                    # Extract price and grade from text
                    price = self.browser._clean_price(text)
                    grade = self.browser._extract_grade(text)
                    
                    # Clean title (remove price/grade noise)
                    title = re.sub(r'[\¥¥,\d~]+', '', text).strip()
                    title = re.sub(r'(PSA\d+|A|B|C|D|PSA8以下)', '', title).strip()
                    title = title[:100]  # Truncate long titles
                    
                    results.append({
                        "item_id": item_id,
                        "title":   title,
                        "price":   price,
                        "grade":   grade,
                        "url":     f"{SNKRDUNK_BASE}{href}"
                    })
                    
                    if len(results) >= max_results:
                        break
                        
                except Exception:
                    continue
                    
        except Exception as e:
            print(f"  [WARN] Search parsing failed: {e}")
        
        return results

# ── Price Aggregator ──────────────────────────────────────────────────────────
class SnkrdunkPriceAggregator:
    """
    Aggregates prices by grade and calculates market metrics.
    """
    
    GRADE_ORDER = ["PSA10", "PSA9", "PSA8", "A", "B", "C", "D", "PSA8以下"]
    
    @staticmethod
    def aggregate(prices_data):
        """
        Given raw last_sales and current_listings, compute market metrics.
        
        Returns dict:
            {
                "psa10_last_sale": 195000,
                "psa9_last_sale": 39800,
                "lowest_ask": 3800,
                "market_grade": "A",
                "price_range_jpy": {"min": 3800, "max": 195000},
                "price_range_hkd": {"min": 195, "max": 9980}
            }
        """
        if not prices_data:
            return None
        
        last_sales = prices_data.get("last_sales", [])
        listings   = prices_data.get("current_listings", [])
        
        # Group by grade
        grade_prices = {}
        for grade, price in last_sales:
            if grade not in grade_prices:
                grade_prices[grade] = {"sales": [], "listings": []}
            grade_prices[grade]["sales"].append(price)
        
        for grade, price in listings:
            if grade not in grade_prices:
                grade_prices[grade] = {"sales": [], "listings": []}
            grade_prices[grade]["listings"].append(price)
        
        # Compute metrics per grade
        metrics = {}
        for grade in SnkrdunkPriceAggregator.GRADE_ORDER:
            if grade not in grade_prices:
                continue
            
            sales = grade_prices[grade]["sales"]
            listing = grade_prices[grade]["listings"]
            
            last_sale = max(sales) if sales else None
            lowest_ask = min(listing) if listing else None
            
            if last_sale:
                metrics[f"{grade.lower()}_last_sale"] = last_sale
            if lowest_ask:
                metrics[f"{grade.lower()}_lowest_ask"] = lowest_ask
        
        # Market grade = grade with highest price
        if metrics:
            market_grade = max(metrics.items(), key=lambda x: x[1] or 0)[0]
        else:
            market_grade = "unknown"
        
        # Overall range
        all_prices = list(metrics.values())
        if all_prices:
            metrics["price_range_jpy"] = {
                "min": min(all_prices),
                "max": max(all_prices)
            }
            metrics["price_range_hkd"] = {
                "min": int(min(all_prices) * JPY_TO_HKD),
                "max": int(max(all_prices) * JPY_TO_HKD)
            }
        
        metrics["lowest_ask"] = prices_data.get("lowest_ask")
        metrics["market_grade"] = market_grade
        
        return metrics

# ── Firestore Writer ──────────────────────────────────────────────────────────
class SnkrdunkFirestoreWriter:
    """
    Writes SNKRDUNK price data to Firestore.
    Structure: cards/{card_id}/market_data/snkrdunk_jp
    """
    
    def __init__(self, db):
        self.db = db
    
    def write_prices(self, card_id, prices_data, metadata=None):
        """
        Write aggregated price data to Firestore.
        
        Args:
            card_id:    e.g. "sm-p-365" (slug format)
            prices_data: dict from PriceAggregator.aggregate()
            metadata:   optional dict with additional fields (name, set_code, etc.)
        """
        if not prices_data:
            print(f"  [WARN] No price data to write for {card_id}")
            return False
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Build Firestore document
        doc_data = {
            "last_updated":    now,
            "market":          "snkrdunk_jp",
            "currency":        "JPY",
            "lowest_ask_jpy":  prices_data.get("lowest_ask"),
            "market_grade":    prices_data.get("market_grade"),
            "price_range_jpy": prices_data.get("price_range_jpy", {}),
            "price_range_hkd": prices_data.get("price_range_hkd", {}),
        }
        
        # Add grade-specific prices
        for grade in ["psa10", "psa9", "psa8", "a", "b", "c", "d"]:
            last_sale_key  = f"{grade}_last_sale"
            lowest_ask_key = f"{grade}_lowest_ask"
            
            if last_sale_key in prices_data:
                doc_data[f"psa_last_sale"] = prices_data[last_sale_key]
            if lowest_ask_key in prices_data:
                doc_data[f"psa_lowest_ask"] = prices_data[lowest_ask_key]
        
        # Add metadata if provided
        if metadata:
            doc_data["card_name"] = metadata.get("name", "")
            doc_data["set_code"]   = metadata.get("set_code", "")
        
        # Write to Firestore
        try:
            doc_ref = self.db.collection("cards").document(card_id)
            market_ref = doc_ref.collection("market_data").document("snkrdunk_jp")
            market_ref.set(doc_data)
            
            print(f"  [FIRESTORE] ✓ Wrote to cards/{card_id}/market_data/snkrdunk_jp")
            return True
        except Exception as e:
            print(f"  [ERROR] Firestore write failed: {e}")
            return False

# ── Main Scraper Class ────────────────────────────────────────────────────────
class SnkrdunkScraperV2:
    """
    Main entry point for SNKRDUNK scraper.
    Combines search, price extraction, and Firestore write.
    """
    
    def __init__(self, use_proxy=True):
        print("[INIT] Starting SNKRDUNK Scraper v2...")
        
        # Init Firebase
        try:
            self.db = init_firebase()
            print("[INIT] Firebase connected ✓")
        except Exception as e:
            print(f"[WARN] Firebase init failed: {e}")
            self.db = None
        
        # Init browser
        self.browser = SnkrdunkBrowser(use_proxy=use_proxy)
        
        # Init sub-components
        self.search = SnkrdunkSearchEngine(self.browser)
        self.aggregator = SnkrdunkPriceAggregator()
        self.writer = SnkrdunkFirestoreWriter(self.db) if self.db else None
        
        print("[INIT] SNKRDUNK Scraper v2 ready ✓")
    
    def scrape_item(self, item_id, card_id=None, metadata=None):
        """
        Scrape a single item by SNKRDUNK item_id.
        
        Args:
            item_id:   SNKRDUNK's internal item_id (e.g. "107574")
            card_id:   Optional Firestore card ID (defaults to item_id)
            metadata:  Optional dict with name/set_code for Firestore
        
        Returns:
            dict with scraped and aggregated price data
        """
        if not card_id:
            card_id = item_id  # Use item_id as card_id
        
        url = f"{SNKRDUNK_BASE}/apparels/{item_id}"
        print(f"\n[SCRAPE] {url}")
        
        # Fetch page
        page = self.browser.get_page(url)
        if not page:
            print(f"  [ERROR] Page fetch failed for {item_id}")
            return None
        
        # Extract prices
        raw_prices = self.browser.extract_prices_from_page(page)
        if not raw_prices:
            print(f"  [WARN] No price data extracted for {item_id}")
            return None
        
        # Aggregate
        aggregated = self.aggregator.aggregate(raw_prices)
        
        # Print summary
        print(f"  [PRICES] Last Sales: {len(raw_prices['last_sales'])} records")
        print(f"  [PRICES] Listings:  {len(raw_prices['current_listings'])} records")
        print(f"  [PRICES] Lowest Ask: ¥{aggregated.get('lowest_ask', 'N/A'):,}")
        print(f"  [PRICES] Market Grade: {aggregated.get('market_grade', 'unknown')}")
        
        if aggregated.get("psa10_last_sale"):
            hkd = int(aggregated["psa10_last_sale"] * JPY_TO_HKD)
            print(f"  [PRICES] PSA10 Last Sale: ¥{aggregated['psa10_last_sale']:,} (≈ HKD {hkd:,})")
        
        # Write to Firestore
        if self.writer:
            self.writer.write_prices(card_id, aggregated, metadata)
        
        return aggregated
    
    def search_and_scrape(self, keyword, card_id=None, max_results=5):
        """
        Search for keyword, then scrape the top results.
        
        Args:
            keyword:    Search term (e.g. "アーマードミュウツー SM-P 365")
            card_id:    Optional Firestore card ID
            max_results: Max number of results to scrape
        
        Returns:
            List of dicts with scraped price data
        """
        print(f"\n[SEARCH] Keyword: {keyword}")
        
        # Discover item_ids
        results = self.search.search(keyword, max_results=max_results)
        
        if not results:
            print(f"  [WARN] No results found for '{keyword}'")
            return []
        
        print(f"  [SEARCH] Found {len(results)} items")
        
        scraped = []
        
        for i, item in enumerate(results):
            print(f"\n  [{i+1}/{len(results)}] Item: {item['item_id']}")
            print(f"         Title: {item['title'][:60]}...")
            
            # Scrape each item
            data = self.scrape_item(
                item_id=item["item_id"],
                card_id=card_id,
                metadata={
                    "name":     item["title"],
                    "url":      item["url"],
                    "grade":    item.get("grade", ""),
                    "price":    item.get("price", 0)
                }
            )
            
            if data:
                scraped.append(data)
            
            # Random delay between requests
            delay = random.uniform(MIN_DELAY, MAX_DELAY)
            print(f"  [DELAY] Waiting {delay:.1f}s...")
            time.sleep(delay)
        
        return scraped

# ── CLI Interface ──────────────────────────────────────────────────────────────
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="SNKRDUNK Scraper v2 — JP-HK Premium Radar")
    
    parser.add_argument("--item-id",    type=str, help="SNKRDUNK item_id to scrape (e.g. 107574)")
    parser.add_argument("--keyword",    type=str, help="Search keyword (e.g. 'アーマードミュウツー SM-P 365')")
    parser.add_argument("--card-id",    type=str, help="Firestore card ID (default: item_id)")
    parser.add_argument("--max-results", type=int, default=5, help="Max search results (default: 5)")
    parser.add_argument("--no-proxy",    action="store_true", help="Disable Herman Proxy, use direct HTTPS")
    parser.add_argument("--test",        action="store_true", help="Test mode: scrape only, no Firestore write")
    
    args = parser.parse_args()
    
    # Initialize scraper
    scraper = SnkrdunkScraperV2(use_proxy=not args.no_proxy)
    
    if args.item_id:
        # Direct item scrape
        result = scraper.scrape_item(args.item_id, args.card_id)
        
        if result:
            print("\n" + "="*60)
            print("RESULT:")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("\n[ERROR] Scrape failed")
            sys.exit(1)
    
    elif args.keyword:
        # Search and scrape
        results = scraper.search_and_scrape(args.keyword, args.card_id, args.max_results)
        
        print("\n" + "="*60)
        print(f"SCraped {len(results)} items")
        
        for i, r in enumerate(results):
            print(f"\n  [{i+1}] Market Grade: {r.get('market_grade', 'unknown')}")
            print(f"      Lowest Ask: ¥{r.get('lowest_ask', 0):,}")
            if r.get("psa10_last_sale"):
                print(f"      PSA10 Sale: ¥{r['psa10_last_sale']:,}")
    
    else:
        parser.print_help()
        print("\nExamples:")
        print("  python scraper_snkrdunk_v2.py --item-id 107574")
        print("  python scraper_snkrdunk_v2.py --keyword 'アーマードミュウツー SM-P 365'")
        print("  python scraper_snkrdunk_v2.py --keyword 'ミュウツー PROMO' --max-results 10")

if __name__ == "__main__":
    main()