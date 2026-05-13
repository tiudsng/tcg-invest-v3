#!/usr/bin/env python3
"""
scraper_snkrdunk.py — SNKRDUNK 日本價格爬蟲
============================================
用途：從 snkrdunk.com 提取 Pokemon 卡牌日圓價格 (JPY)
方法：Herman Proxy (curl_cffi) + JSON-LD 解析
依賴：requests, Herman Proxy 運行在 127.0.0.1:18765

用法：
  python3 scraper_snkrdunk.py --item_id 44040786
  python3 scraper_snkrdunk.py --item_id 44040786 --write_firestore
  python3 scraper_snkrdunk.py --batch 44040786,44040787,44040788
"""

import requests
import json
import re
import sys
import os
import argparse
from datetime import datetime

# Firebase
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    HAS_FIREBASE = True
except ImportError:
    HAS_FIREBASE = False

PROXY_URL = "http://127.0.0.1:18765"
PROXY_TIMEOUT = 45

class SnkrdunkScraper:
    """SNKRDUNK JSON-LD 價格提取器"""
    
    def __init__(self, proxy_url=PROXY_URL):
        self.proxy_url = proxy_url
        self.session = requests.Session()
    
    def fetch(self, url, target="stealth_chrome"):
        """透過 Herman Proxy 抓取頁面"""
        try:
            resp = self.session.get(
                f"{self.proxy_url}/fetch",
                params={"url": url, "target": target},
                timeout=PROXY_TIMEOUT
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data.get("content", "")
            return None
        except Exception as e:
            print(f"[ERROR] Fetch failed: {e}", file=sys.stderr)
            return None
    
    def extract_json_ld(self, html):
        """從 HTML 提取 JSON-LD 數據（支持 @graph 格式）"""
        pattern = r'<script type="application/ld\+json">(.*?)</script>'
        matches = re.findall(pattern, html, re.DOTALL)
        
        for block in matches:
            try:
                json_data = json.loads(block)
                
                # Case 1: Direct Product
                if json_data.get("@type") == "Product":
                    return self._parse_product(json_data)
                
                # Case 2: @graph array — find Product inside
                if "@graph" in json_data:
                    for item in json_data.get("@graph", []):
                        if isinstance(item, dict) and item.get("@type") == "Product":
                            return self._parse_product(item)
                            
            except (json.JSONDecodeError, KeyError):
                continue
        
        return None
    
    def _parse_product(self, json_data):
        """解析 Product JSON-LD"""
        offers = json_data.get("offers", {})
        return {
            "name": json_data.get("name", ""),
            "item_id": json_data.get("productID", ""),
            "price": offers.get("price"),
            "currency": offers.get("priceCurrency", "JPY"),
            "grade": offers.get("description", ""),
            "sku": json_data.get("sku", ""),
            "brand": json_data.get("brand", {}).get("name", ""),
            "release_date": json_data.get("releaseDate", ""),
            "image_url": json_data.get("image", ""),
            "availability": offers.get("availability", ""),
            "item_condition": offers.get("itemCondition", ""),
        }
    
    def get_price(self, item_id):
        """獲取單一 item_id 的價格"""
        # 日文版以獲得 JPY 價格
        url = f"https://snkrdunk.com/apparels/91323/used/{item_id}"
        
        html = self.fetch(url)
        if not html:
            return {"item_id": item_id, "error": "fetch_failed", "success": False}
        
        data = self.extract_json_ld(html)
        if data:
            data["success"] = True
            data["fetched_at"] = datetime.now().isoformat()
            return data
        
        return {"item_id": item_id, "error": "no_json_ld", "success": False}
    
    def batch_get(self, item_ids, target="stealth_chrome"):
        """批量獲取多個 item_id 的價格"""
        results = []
        for i, item_id in enumerate(item_ids, 1):
            print(f"[{i}/{len(item_ids)}] Fetching {item_id}...", end=" ")
            result = self.get_price(item_id)
            if result.get("success"):
                print(f"✅ ¥{result['price']:,} ({result.get('grade','')})")
            else:
                print(f"❌ {result.get('error', 'unknown')}")
            results.append(result)
        return results


class FirebaseWriter:
    """寫入 Firestore"""
    
    def __init__(self):
        self.db = None
        self._init_firebase()
    
    def _init_firebase(self):
        if not HAS_FIREBASE:
            print("[WARN] Firebase SDK not available", file=sys.stderr)
            return
        
        # 從環境變量或默認路徑加載 credential
        cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        elif os.path.exists("/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json"):
            cred = credentials.Certificate("/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json")
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        print("[INFO] Firebase initialized")
    
    def write_snkrdunk_price(self, card_slug, item_id, price_data):
        """寫入 SNKRDUNK 價格到 Firestore
        
        路徑: snkrdunk_prices/{item_id}
        """
        if not self.db:
            print("[WARN] Firebase not connected, skipping write")
            return False
        
        doc_ref = self.db.collection("snkrdunk_prices").document(str(item_id))
        doc_ref.set({
            "card_slug": card_slug,
            "item_id": str(item_id),
            "price_jpy": price_data.get("price"),
            "currency": "JPY",
            "name": price_data.get("name", ""),
            "grade": price_data.get("grade", ""),
            "sku": price_data.get("sku", ""),
            "fetched_at": price_data.get("fetched_at", datetime.now().isoformat()),
            "updated_at": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        print(f"[FIREBASE] Written snkrdunk_prices/{item_id}")
        return True
    
    def write_batch(self, items):
        """批量寫入（使用 batch）"""
        if not self.db:
            return 0
        
        batch = self.db.batch()
        count = 0
        
        for item in items:
            if not item.get("success"):
                continue
            doc_ref = self.db.collection("snkrdunk_prices").document(item["item_id"])
            batch.set(doc_ref, {
                "price_jpy": item.get("price"),
                "currency": "JPY",
                "name": item.get("name", ""),
                "grade": item.get("grade", ""),
                "fetched_at": item.get("fetched_at"),
                "updated_at": firestore.SERVER_TIMESTAMP,
            }, merge=True)
            count += 1
        
        batch.commit()
        print(f"[FIREBASE] Batch written {count} items")
        return count


def main():
    parser = argparse.ArgumentParser(description="SNKRDUNK Scraper")
    parser.add_argument("--item_id", type=str, help="Single item ID (e.g., 44040786)")
    parser.add_argument("--batch", type=str, help="Comma-separated item IDs")
    parser.add_argument("--write_firestore", action="store_true", help="Write to Firestore")
    parser.add_argument("--card_slug", type=str, help="Card slug for Firestore reference")
    
    args = parser.parse_args()
    
    if not args.item_id and not args.batch:
        print("Usage: scraper_snkrdunk.py --item_id 44040786 [--write_firestore]")
        print("   or: scraper_snkrdunk.py --batch 44040786,44040787,44040788")
        sys.exit(1)
    
    scraper = SnkrdunkScraper()
    writer = FirebaseWriter() if args.write_firestore else None
    
    if args.item_id:
        result = scraper.get_price(args.item_id)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        if writer and result.get("success"):
            writer.write_snkrdunk_price(args.card_slug or "", args.item_id, result)
    
    elif args.batch:
        item_ids = [x.strip() for x in args.batch.split(",")]
        results = scraper.batch_get(item_ids)
        
        if writer:
            writer.write_batch(results)
        
        # Summary
        success = sum(1 for r in results if r.get("success"))
        print(f"\n=== Summary: {success}/{len(results)} succeeded ===")


if __name__ == "__main__":
    main()