"""
jpy_monitor.py — JPY/HKD 匯率監控警報
用途: 當 JPY/HKD 低於閾值時，發送 Telegram 警報
Cron: 每 4 小時 GitHub Actions
"""

import os
import sys
import requests
from datetime import datetime, timezone

# ─── Config ───────────────────────────────────────────────────────────────────

THRESHOLD = float(os.getenv("JPY_THRESHOLD", "0.050"))  # HKD per JPY
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
API_URL = "https://open.er-api.com/v6/latest/JPY"

# ─── Logger ───────────────────────────────────────────────────────────────────

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

# ─── Core ─────────────────────────────────────────────────────────────────────

def fetch_rate():
    resp = requests.get(API_URL, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    rate = data["rates"].get("HKD")
    log(f"JPY/HKD rate: {rate}")
    return rate

def send_alert(rate):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping alert")
        return

    # Escape special chars for MarkdownV2
    rate_str = f"{rate:.5f}"
    threshold_str = f"{THRESHOLD:.5f}"

    message = (
        f"🚨 *日幣低點警報* 🚨\n\n"
        f"JPY/HKD: *{rate_str}*\n"
        f"閾值: {threshold_str}\n"
        f"狀態: 低於目標 ✅ 準備掃貨"
    )

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }

    resp = requests.post(url, json=payload, timeout=10)
    if resp.ok:
        log(f"Alert sent! {resp.json().get('ok', '?')}")
    else:
        log(f"Alert failed: {resp.text}")

def main():
    log(f"JPY Monitor — threshold={THRESHOLD}")
    try:
        rate = fetch_rate()
    except Exception as e:
        log(f"Failed to fetch rate: {e}")
        sys.exit(1)

    if rate and rate < THRESHOLD:
        log(f"⚠️  Rate {rate} below threshold {THRESHOLD} — triggering alert")
        send_alert(rate)
    else:
        log(f"Rate OK — no alert (rate={rate}, threshold={THRESHOLD})")

if __name__ == "__main__":
    main()
