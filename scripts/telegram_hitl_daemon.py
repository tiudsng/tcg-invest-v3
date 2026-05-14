#!/usr/bin/env python3
"""
Telegram HITL Callback Daemon — P1.5 Mobile-First Human-in-the-Loop
Listens for button presses from xiaolongxia_bot and resumes LangGraph pipelines.
"""

import os
import json
import time
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("hitl_daemon")

# ── Config ────────────────────────────────────────────────────────────────────
BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "8642765029:AAE3kn8_28mPOlWLC_4xfNs-RtQje9XCOm8")
CHAT_ID = int(os.getenv("TG_CHAT_ID", "8217991576"))  # Tidus Ai

POLL_INTERVAL_SEC = 3
STATE_DIR = Path("/tmp/hitl_interrupt")
STATE_DIR.mkdir(exist_ok=True)

# ── Interrupt State File ───────────────────────────────────────────────────────
# Written by langgraph_psa_sync.py when interrupt() is called.
# Format: {thread_id}.json
#   {
#     "thread_id": "psa-20260514-190452",
#     "task_id": "psa-sync-...",
#     "tier": "YELLOW",
#     "confidence": 0.62,
#     "disputed_data": {...},
#     "created_at": "2026-05-14T19:04:52Z",
#     "message_id": 123  # Telegram message ID to update
#   }

def get_interrupt_state(thread_id: str) -> dict | None:
    path = STATE_DIR / f"{thread_id}.json"
    if path.exists():
        return json.loads(path.read_text())
    return None

def save_interrupt_state(thread_id: str, state: dict):
    path = STATE_DIR / f"{thread_id}.json"
    path.write_text(json.dumps(state, indent=2))
    logger.info(f"Saved interrupt state: {thread_id}")

def clear_interrupt_state(thread_id: str):
    path = STATE_DIR / f"{thread_id}.json"
    if path.exists():
        path.unlink()
        logger.info(f"Cleared interrupt state: {thread_id}")

# ── Telegram Bot API ───────────────────────────────────────────────────────────
import urllib.request
import urllib.error

def tg_request(method: str, data: dict | None = None) -> dict | None:
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    try:
        body = json.dumps(data or {}).encode() if data else None
        req = urllib.request.Request(url, data=body,
                                      headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.error(f"TG API error ({method}): {e}")
        return None

def send_message(text: str, reply_markup: dict | None = None, chat_id: int = CHAT_ID) -> int | None:
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    result = tg_request("sendMessage", payload)
    if result and result.get("ok"):
        return result["result"]["message_id"]
    return None

def edit_reply_markup(message_id: int, text: str | None = None, reply_markup: dict | None = None, chat_id: int = CHAT_ID):
    """Edit the inlinekeyboard to reflect the decision made."""
    payload = {"chat_id": chat_id, "message_id": message_id}
    if text:
        payload["text"] = text
    if reply_markup:
        payload["reply_markup"] = reply_markup
    else:
        payload["reply_markup"] = json.dumps({"inline_keyboard": []})
    return tg_request("editMessageReplyMarkup", payload)

def build_interrupt_keyboard(tier: str, thread_id: str) -> dict:
    """Build 3-button InlineKeyboard for HITL decisions."""
    # Format: callback_data = "HITL:thread_id:decision"
    base = f"HITL:{thread_id}"
    return {
        "inline_keyboard": [
            [
                {"text": "✅ OVERRIDE", "callback_data": f"{base}:OVERRIDE"},
                {"text": "🔄 RETRY", "callback_data": f"{base}:RETRY"},
                {"text": "⏭️ IGNORE", "callback_data": f"{base}:IGNORE"},
            ]
        ]
    }

def format_interrupt_message(state: dict) -> str:
    """Format HITL alert as Apple-style Bento card."""
    tier = state.get("tier", "?")
    tier_emoji = {"YELLOW": "⚠️", "RED": "🔴"}.get(tier, "⚠️")
    conf = state.get("confidence", state.get("disputed_data", {}).get("confidence_score", "?"))
    thread_id = state.get("thread_id", "?")
    reason = state.get("disputed_data", {}).get("reason", "Low confidence detected")
    code_path = state.get("disputed_data", {}).get("code_path", "N/A")

    return (
        f"{tier_emoji} <b>Pipeline Interrupted — {tier} TIER</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📊 Confidence: <b>{conf}</b>\n"
        f"🧵 Thread: <code>{thread_id}</code>\n"
        f"📋 Reason: {reason}\n"
        f"📁 Path: <code>{code_path}</code>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"Choose your action:"
    )

# ── Resume Pipeline ─────────────────────────────────────────────────────────────
def resume_pipeline(thread_id: str, decision: str) -> bool:
    """Call langgraph_psa_sync.py --resume to continue the graph."""
    import subprocess
    cmd = [
        "python3", "/home/ubuntu/tcg-invest-v3/scripts/langgraph_psa_sync.py",
        "--resume", thread_id,
        "--decision", decision
    ]
    logger.info(f"Resuming pipeline: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        logger.info(f"Resume output: {result.stdout[:500]}")
        if result.returncode == 0:
            return True
        else:
            logger.error(f"Resume failed: {result.stderr[:200]}")
            return False
    except Exception as e:
        logger.error(f"Resume exception: {e}")
        return False

# ── Polling Loop ───────────────────────────────────────────────────────────────
def run_polling():
    """Poll Telegram for callback queries (lightweight替代Webhook）。"""
    logger.info("Starting HITL Telegram Daemon...")

    # Reset getUpdates offset to only get new updates
    offset = None

    while True:
        try:
            payload = {"timeout": 5}
            if offset:
                payload["offset"] = offset

            updates = tg_request("getUpdates", payload)

            if not updates or not updates.get("ok"):
                time.sleep(POLL_INTERVAL_SEC)
                continue

            for update in updates.get("result", []):
                offset = update["update_id"] + 1

                # Handle callback_query
                if "callback_query" in update:
                    callback = update["callback_query"]
                    data = callback.get("data", "")

                    if data.startswith("HITL:"):
                        parts = data.split(":")
                        if len(parts) >= 3:
                            thread_id = parts[1]
                            decision = parts[2]  # OVERRIDE | RETRY | IGNORE

                            logger.info(f"Callback received: thread={thread_id} decision={decision}")

                            # Get interrupt state
                            state = get_interrupt_state(thread_id)
                            if not state:
                                # Try to find by searching state files
                                logger.warning(f"No interrupt state found for {thread_id}")

                            # Acknowledge the button press
                            tg_request("answerCallbackQuery", {"callback_query_id": callback["id"]})

                            # Format confirmation message
                            decision_emoji = {"OVERRIDE": "✅", "RETRY": "🔄", "IGNORE": "⏭️"}.get(decision, "❓")
                            confirm_text = (
                                f"{decision_emoji} <b>Decision Received</b>\n"
                                f"Thread: <code>{thread_id}</code>\n"
                                f"Action: <b>{decision}</b>\n"
                                f"⏳ Processing..."
                            )
                            # Edit original message
                            msg_id = state.get("message_id") if state else None
                            chat_id = callback["message"]["chat"]["id"]
                            if msg_id:
                                edit_reply_markup(msg_id, confirm_text, None, chat_id)

                            # Resume pipeline in background
                            success = resume_pipeline(thread_id, decision)
                            if success:
                                final_text = (
                                    f"{decision_emoji} <b>Pipeline Resumed</b>\n"
                                    f"✅ Decision <b>{decision}</b> applied to thread <code>{thread_id}</code>"
                                )
                            else:
                                final_text = (
                                    f"❌ <b>Resume Failed</b>\n"
                                    f"Thread: <code>{thread_id}</code>\n"
                                    f"Check CVM logs for details."
                                )

                            # Update message with result
                            if msg_id:
                                edit_reply_markup(msg_id, final_text, None, chat_id)

                            # Clean up state
                            if state:
                                clear_interrupt_state(thread_id)

                # Handle /start or /status commands
                elif "message" in update:
                    text = update["message"].get("text", "")
                    chat_id = update["message"]["chat"]["id"]
                    if text == "/start" or text == "/status":
                        send_message(
                            "🔍 <b>HITL Daemon Active</b>\n"
                            "Monitoring for pipeline interruptions...\n"
                            f"State dir: {STATE_DIR}",
                            chat_id=chat_id
                        )

        except Exception as e:
            logger.error(f"Polling error: {e}")
            time.sleep(POLL_INTERVAL_SEC)

# ── Entry Point ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if "--help" in sys.argv:
        print("Usage: python3 telegram_hitl_daemon.py [--once]")
        print("  --once  Run one poll cycle then exit (for testing)")
        sys.exit(0)

    if "--once" in sys.argv:
        run_polling()
    else:
        run_polling()  # Daemon mode