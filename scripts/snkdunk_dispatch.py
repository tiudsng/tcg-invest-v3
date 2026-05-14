"""
SNKRDUNK Dispatch Script — GA Runner 執行（批次模式）
從 GitHub Actions Runner 调用，执行后回传 Firestore

支援批次抓取（一次最多 25 張卡）
使用方法（GA Runner）：
  python scripts/snkdunk_dispatch.py --batch /tmp/batch_job.json
"""

import json, os, sys, time, urllib.request
from datetime import datetime
from typing import List, Dict

# ── 引數解析 ──────────────────────────────────────────

def parse_args():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--batch", help="批次 job JSON 文件路徑")
    p.add_argument("--url", help="單一 URL（舊版向後兼容）")
    p.add_argument("--ua", default="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
    p.add_argument("--navigator-ua", default="")
    p.add_argument("--callback", help="單一 callback URL")
    p.add_argument("--thread-id", help="單一 thread ID")
    p.add_argument("--timeout", type=int, default=60)
    return p.parse_args()

args = parse_args()

# ── 核心爬蟲（單個 URL）─────────────────────────────

def scrape_one(url: str, user_agent: str, navigator_ua: str = "", timeout: int = 60) -> dict:
    """執行單個 URL 的爬蟲"""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            final_ua = navigator_ua if navigator_ua else user_agent
            browser = p.chromium.launch(headless=True, args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ])
            context = browser.new_context(user_agent=final_ua)
            page = context.new_page()

            # 注入 stealth JS
            page.add_init_script(f"""
                Object.defineProperty(navigator, 'userAgent', {{get: () => '{final_ua}'}});
                delete window.cdc_adoQpoasnfaaPdfSClpbdf;
                delete window.webdriver;
            """)

            page.goto(url, timeout=timeout * 1000)
            page.wait_for_load_state("networkidle", timeout=timeout * 1000)

            # 提取價格（視覺錨點法）
            price_text = ""
            try:
                # 嘗試日文「 판매価格」或「最安値」
                price_el = page.locator("text=最安値").first
                if price_el.count() > 0:
                    price_text = price_el.inner_text()
                else:
                    # fallback: 正則找 ¥ 符號
                    content = page.content()
                    import re
                    m = re.search(r'¥[\\d,]+', content)
                    if m:
                        price_text = m.group(0)
            except Exception:
                pass

            # 提取 grade
            grade = ""
            try:
                grade_el = page.locator("[data-testid='grade-selector']").first
                if grade_el.count() > 0:
                    grade = grade_el.inner_text()
            except Exception:
                pass

            # 提取庫存
            stock = "unknown"
            try:
                if page.locator("text=カートに入れる").count() > 0:
                    stock = "available"
                elif page.locator("text=売り切れ").count() > 0:
                    stock = "out_of_stock"
                elif page.locator("text=残りわずか").count() > 0:
                    stock = "low_stock"
            except Exception:
                pass

            browser.close()

            return {
                "status": "success",
                "price_text": price_text,
                "grade": grade,
                "stock_status": stock,
                "scraped_at": datetime.utcnow().isoformat()
            }

    except Exception as e:
        return {"status": "failed", "error": str(e), "scraped_at": datetime.utcnow().isoformat()}


# ── 回傳 Firestore ────────────────────────────────────

def report_back(callback_url: str, result: dict, thread_id: str):
    """POST 結果回 Firestore"""
    try:
        data = json.dumps({"fields": {k: {"stringValue": str(v)} for k, v in result.items()}}).encode()
        doc_url = f"{callback_url}/{thread_id}"
        req = urllib.request.Request(doc_url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[Dispatch] Callback sent for {thread_id}: {resp.status}")
    except Exception as e:
        print(f"[Dispatch] Callback failed for {thread_id}: {e}")
        with open(f"/tmp/callback_{thread_id}.json", "w") as f:
            json.dump(result, f)


# ── 批次執行主程序 ────────────────────────────────────

def run_batch(batch_file: str):
    """批次模式：讀取 batch_job.json，並行抓取後回傳"""
    with open(batch_file) as f:
        batch = json.load(f)

    batch_id = batch.get("batch_id", "unknown")
    jobs = batch.get("jobs", [])
    callback_base = batch.get("callback_base", "")

    print(f"[Dispatch] Batch {batch_id}: {len(jobs)} jobs")

    results = []
    for job in jobs:
        thread_id = job.get("thread_id")
        url = job.get("url")
        user_agent = job.get("user_agent", args.ua)
        navigator_ua = job.get("navigator_ua", "")
        schema = job.get("schema", {})

        print(f"[Dispatch] Processing {thread_id}: {url}")
        result = scrape_one(url, user_agent, navigator_ua, timeout=args.timeout)
        result["thread_id"] = thread_id
        result["card_id"] = job.get("card_id", "")
        result["batch_id"] = batch_id

        results.append(result)

        # 回傳
        if callback_base:
            report_back(callback_base, result, thread_id)

        # 避免觸發 rate limit
        time.sleep(2)

    print(f"[Dispatch] Batch {batch_id} complete: {len(results)}/{len(jobs)} done")
    return results


# ── 主程序 ────────────────────────────────────────────

if __name__ == "__main__":
    if args.batch and os.path.exists(args.batch):
        run_batch(args.batch)
    elif args.url:
        # 單一 URL 模式（向後兼容）
        result = scrape_one(args.url, args.ua, args.navigator_ua, args.timeout)
        result["thread_id"] = args.thread_id or "unknown"
        if args.callback:
            report_back(args.callback, result, args.thread_id)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("Usage: python snkdunk_dispatch.py --batch /tmp/batch_job.json")
        print("   or: python snkdunk_dispatch.py --url ... --callback ...")
        sys.exit(1)