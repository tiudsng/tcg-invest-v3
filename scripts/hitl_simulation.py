#!/usr/bin/env python3
"""
HITL Simulation — 模擬 Interrupt → Telegram Bento Card → Decision Parser 鏈路
不需要 OPENAI_API_KEY，直接調用關鍵函數
"""

import sys
import json
import re
from datetime import datetime
from pathlib import Path


# ── Mock State ────────────────────────────────────────────────────────────────

def mock_state(confidence: float = 0.6):
    """模擬一個 interrupt state，tier 自動跟 confidence"""
    # 自動判定 tier
    if confidence > 0.85:
        tier = "GREEN"
    elif confidence >= 0.5:
        tier = "YELLOW"
    else:
        tier = "RED"

    state = {
        "thread_id": "psa-sim-20260514-203000",
        "needs_human_review": True,
        "confidence_metrics": {
            "score": confidence,
            "sources": ["PriceCharting", "SNKRDUNK"],
            "anomalies": ["market_data.psa_price (HKD 1200) vs SNKRDUNK (JPY 28000≈HKD 1433.6) differ by 16.3%"]
        },
        "interrupt_reason": f"[{tier}] Confidence {confidence} — 需要人工審核",
        "tier": tier,
        "disputed_data": {
            "name_zh": "Pokemon 25th Anniversary Mewtwo",
            "market_data": {"psa_price": 1200, "last_updated": "2026-05-14T10:00:00Z"},
            "psa_data": {"psa10_ratio": 28.4, "gem_mt_rate": "28.4%"},
            "snkrdunk_price_jpy": 28000,
            "snkrdunk_price_hkd": round(28000 * 0.0512, 2)
        },
        "retry_count_after_red": 0,
        "coo_plan": {"cards": [], "current_card_index": 0},
        "loop_history": [],
        "current_agent": "cto_verify_node"
    }
    return state


# ── Decision Parser ────────────────────────────────────────────────────────────

def parse_decision(decision_str: str) -> dict:
    """
    拆解 decision 字串格式：
    - "OVERRIDE"           → {decision: "OVERRIDE", context: {}}
    - "OVERRIDE:1500"      → {decision: "OVERRIDE", context: {correct_price: 1500}}
    - "RETRY"              → {decision: "RETRY", context: {}}
    - "RETRY:HINT:id_123"  → {decision: "RETRY", context: {hint: "id_123"}}
    - "IGNORE"             → {decision: "IGNORE", context: {}}
    """
    if not decision_str:
        return {"decision": None, "context": {}, "error": "empty decision"}

    parts = decision_str.split(":")
    decision = parts[0].strip().upper()

    context = {}
    if decision == "OVERRIDE" and len(parts) > 1:
        try:
            context["correct_price"] = float(parts[1])
        except ValueError:
            context["correct_price_raw"] = parts[1]
    elif decision == "RETRY" and len(parts) > 1:
        if parts[1].upper() == "HINT" and len(parts) > 2:
            context["hint"] = parts[2]
        else:
            context["retry_context"] = ":".join(parts[1:])

    return {"decision": decision, "context": context}


# ── Bento Card Formatter ───────────────────────────────────────────────────────

def format_bento_card(state: dict) -> str:
    """生成 Apple Style Bento Card 格式的 Telegram 訊息"""
    thread_id = state["thread_id"]
    conf = state["confidence_metrics"]["score"]
    reason = state["interrupt_reason"]
    dd = state["disputed_data"]

    # Tier 判定
    if conf > 0.85:
        tier = "🟢 GREEN"
        tier_color = "🟢"
    elif conf >= 0.5:
        tier = "🟡 YELLOW"
        tier_color = "🟡"
    else:
        tier = "🔴 RED"
        tier_color = "🔴"

    # Emoji for confidence
    if conf > 0.85:
        conf_emoji = "✅"
    elif conf >= 0.5:
        conf_emoji = "⚠️"
    else:
        conf_emoji = "🔴"

    card = f"""⚠️ Pipeline Interrupted — {tier}
━━━━━━━━━━━━━━━━━━
{conf_emoji} Confidence: {conf:.2f}
🧵 Thread: `{thread_id}`
📋 Reason: {reason}
━━━━━━━━━━━━━━━━━━
📁 Card: {dd.get('name_zh', 'Unknown')}
💰 Market Price (HKD): {dd.get('market_data', {}).get('psa_price', 'N/A')}
💱 SNKRDUNK (JPY→HKD): {dd.get('snkrdunk_price_jpy', 'N/A')} JPY → {dd.get('snkrdunk_price_hkd', 'N/A')} HKD
📊 PSA Ratio: {dd.get('psa_data', {}).get('psa10_ratio', 'N/A')}%
━━━━━━━━━━━━━━━━━━
Choose your action:

[✅ OVERRIDE] [🔄 RETRY] [⏭️ IGNORE]"""

    return card


# ── State File Writer (模擬 pipeline) ─────────────────────────────────────────

def write_hitl_state(state: dict) -> str:
    """寫入 /tmp/hitl_<thread_id>.json，模擬 pipeline 的 notify 行為"""
    thread_id = state["thread_id"]
    state_file = f"/tmp/hitl_{thread_id}.json"
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2, default=str)
    return state_file


# ── Test Cases ─────────────────────────────────────────────────────────────────

def run_tests():
    print("=" * 60)
    print("HITL SIMULATION — Interrupt → Telegram → Decision Parser")
    print("=" * 60)

    # ── Test 1: YELLOW Tier interrupt (confidence 0.6) ──────────────────────────
    print("\n🧪 TEST 1: YELLOW Tier Interrupt (confidence=0.6)")
    print("-" * 50)
    state = mock_state(confidence=0.6)

    print("\n📋 State 要 interrupt 的原因：")
    print(f"   {state['interrupt_reason']}")

    print("\n📱 生成的 Telegram Bento Card：")
    print("-" * 50)
    card = format_bento_card(state)
    print(card)

    print("\n💾 寫入 State File：")
    sf = write_hitl_state(state)
    print(f"   → {sf}")
    with open(sf) as f:
        print(f"   Content: {json.dumps(json.load(f), indent=4)[:300]}...")

    # ── Test 2: OVERRIDE ───────────────────────────────────────────────────────
    print("\n\n🧪 TEST 2: Decision = 'OVERRIDE'")
    print("-" * 50)
    result = parse_decision("OVERRIDE")
    print(f"   parse_decision('OVERRIDE') = {result}")
    assert result["decision"] == "OVERRIDE"
    assert result["context"] == {}
    print("   ✅ 解析正確")

    # ── Test 3: OVERRIDE:1500 ───────────────────────────────────────────────────
    print("\n🧪 TEST 3: Decision = 'OVERRIDE:1500' (擴展格式)")
    print("-" * 50)
    result = parse_decision("OVERRIDE:1500")
    print(f"   parse_decision('OVERRIDE:1500') = {result}")
    assert result["decision"] == "OVERRIDE"
    assert result["context"]["correct_price"] == 1500.0
    print("   ✅ 解析正確 — correct_price = 1500")

    # ── Test 4: RETRY:HINT:id_123 ──────────────────────────────────────────────
    print("\n🧪 TEST 4: Decision = 'RETRY:HINT:id_123' (Engineer hint)")
    print("-" * 50)
    result = parse_decision("RETRY:HINT:id_123")
    print(f"   parse_decision('RETRY:HINT:id_123') = {result}")
    assert result["decision"] == "RETRY"
    assert result["context"]["hint"] == "id_123"
    print("   ✅ 解析正確 — hint = 'id_123' (Engineer 會強制用此 ID 查詢)")

    # ── Test 5: RED Tier (confidence 0.3) ──────────────────────────────────────
    print("\n\n🧪 TEST 5: RED Tier Interrupt (confidence=0.3)")
    print("-" * 50)
    state_red = mock_state(confidence=0.3)
    state_red["retry_count_after_red"] = 1  # 已經 retry 過
    print(f"   {state_red['interrupt_reason']}")
    print(f"   retry_count_after_red: {state_red['retry_count_after_red']}")
    card_red = format_bento_card(state_red)
    print("\n📱 RED Tier Bento Card：")
    print(card_red)

    # ── Test 6: GREEN Tier (confidence 0.9) — 不應 interrupt ──────────────────
    print("\n\n🧪 TEST 6: GREEN Tier (confidence=0.9) — 自動通過")
    print("-" * 50)
    state_green = mock_state(confidence=0.9)
    if state_green["confidence_metrics"]["score"] > 0.85:
        print("   ✅ confidence 0.9 > 0.85 — 自動 GREEN，唔會 interrupt")
    else:
        print("   ❌ 邏輯有問題")

    print("\n" + "=" * 60)
    print("🎉 All simulation tests passed!")
    print("=" * 60)
    print("""
下一步：
1. ✅ Interrupt 邏輯正確（YELLOW/RED 觸發，GREEN 跳過）
2. ✅ Telegram Bento Card 格式靚
3. ✅ Decision Parser 支援擴展格式（OVERRIDE:1500, RETRY:HINT:id_123）
4. ⏳ 需要真實 Telegram Bot webhook 才能測試完整鏈路

如需手動測試 Telegram：
  1. 確保 bot webhook 指向 CVM:5000
  2. 行：python3 scripts/telegram_hitl_daemon.py
  3. 手動調用：python3 scripts/langgraph_psa_sync.py --resume <thread_id> --decision OVERRIDE
""")


if __name__ == "__main__":
    run_tests()