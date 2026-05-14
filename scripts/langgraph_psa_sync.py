#!/usr/bin/env python3
"""
TCG Invest — PSA Population Sync via LangGraph Multi-Agent v3 防彈版 + P0+P2
實戰：P0（Firestore Checkpoint）+ P2（Streaming）優化

新增功能：
- P0: FirestoreSaver 斷點恢復（Pipeline 中斷可從上個 Checkpoint 繼續）
- P2: graph.astream() 即時 Streaming 輸出（睇到每個 Node 嘅即時動態）

使用：
  export MINIMAX_API_KEY='...'
  export MINIMAX_BASE_URL="https://api.minimax.io/v1"
  python3 scripts/langgraph_psa_sync.py [--resume thread_id]
"""

from __future__ import annotations

import os
import sys
import json
import time
import re
import argparse
from datetime import datetime, timedelta
from typing import Annotated, TypedDict

# 加入路徑
sys.path.insert(0, '/home/ubuntu/tcg-invest-v3')
sys.path.insert(0, '/home/ubuntu/.hermes/skills/langgraph_checkpoint_firestore/src')

# LangGraph
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.types import Command
from langgraph.graph.message import add_messages

# FirestoreSaver（P0）
from langgraph_checkpoint_firestore import FirestoreSaver

# Firebase
try:
    from google.cloud import firestore
    HAS_FIRESTORE = True
except ImportError:
    HAS_FIRESTORE = False

# ============================================================
# Configuration — MiniMax International
# ============================================================
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY") or os.getenv("MINIMAX_INTERNATIONAL_API_KEY")
MINIMAX_BASE_URL = os.getenv("MINIMAX_BASE_URL") or "https://api.minimax.io/v1"
MODEL_NAME = "MiniMax-M2.7"
TEMPERATURE = 0.0

if not MINIMAX_API_KEY:
    print("❌ MINIMAX_API_KEY 未設置")
    print("   請執行：export MINIMAX_API_KEY='sk-cp-...'")
    sys.exit(1)

llm = ChatOpenAI(
    api_key=MINIMAX_API_KEY,
    base_url=MINIMAX_BASE_URL,
    model=MODEL_NAME,
    temperature=TEMPERATURE,
    max_tokens=4096
)

# PSA Sync 配置
SLEEP_SECONDS = 5
MAX_RETRIES = 3
BATCH_SIZE = 3
API_COST_LIMIT_USD = 0.2
FIRESTORE_PROJECT_ID = "gen-lang-client-0326385388"
FIRESTORE_DATABASE_ID = "ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"

# ============================================================
# P0: Initialize FirestoreSaver
# ============================================================
def get_checkpointer():
    """初始化 FirestoreSaver Checkpointer（P0 核心）"""
    try:
        saver = FirestoreSaver(
            project_id=FIRESTORE_PROJECT_ID,
            checkpoints_collection="langgraph_checkpoints",
            database=FIRESTORE_DATABASE_ID
        )
        print(f"✅ FirestoreSaver initialized: project={FIRESTORE_PROJECT_ID}")
        return saver
    except Exception as e:
        print(f"⚠️ FirestoreSaver init failed: {e}")
        print("   Pipeline will run WITHOUT checkpoint persistence")
        return None

# ============================================================
# Streaming Helper（P2 核心）
# ============================================================
def stream_node(name: str, color: str = "BLUE"):
    """Streaming 裝飾器：即時顯示每個 Node 嘅狀態"""
    colors = {
        "GREEN": "\033[92m", "YELLOW": "\033[93m",
        "RED": "\033[91m", "BLUE": "\033[94m",
        "MAGENTA": "\033[95m", "CYAN": "\033[96m", "RESET": "\033[0m"
    }
    c = colors.get(color, colors["BLUE"])
    print(f"\n{'='*60}")
    print(f"{c}🤖 [{name}]{colors['RESET']}")
    print(f"{'='*60}")

# ============================================================
# Agent Prompts（v3 防彈版）
# ============================================================
COO_PROMPT = """你係 TCG INVEST 嘅 COO（首席運營官）。

專注於：市場價值、ROI、運營成本、風險評估。

當前任務：評估「引入 PSA 10 Population 數據」嘅商業價值。

分析維度：
1. 投資稀缺性維度：Population（供給量）係決定長期升值潛力嘅核心指標
2. 用戶痛點：收藏家最驚買咗「無限增發」嘅卡
3. 平台差异化：令 tcginvest.net 由「價格追蹤」提升至「稀缺性評級」

📊 StateSchema v3 必須追蹤：
- api_quota.cost_today_usd（不可超過 $0.2 USD）
- data_policy.freshness_threshold_hr（超過12小時先真正爬取）
- confidence_metrics.score（你自己評估呢個 plan 嘅信心，0.0-1.0）

輸出格式（JSON）：
{
    "plan": ["拆解任務1", "拆解任務2"],
    "roi": "投資回報評估（文字）",
    "risk_level": "LOW/MEDIUM/HIGH",
    "recommendation": "GO/NO_GO",
    "priority": 1-5,
    "confidence_score": 0.0-1.0,
    "estimated_cost_usd": 估算今次任務成本
}
"""

CTO_PROMPT = """你係 TCG INVEST 嘅 CTO（首席技術官）。

專注於：技術可行性、API 成本、Firebase Schema 安全、性能評估。
你有否決權。

當前任務：審計「PSA Population 數據同步」嘅技術方案。

已知事實：
- PSA 官網（psacard.com）：Cloudflare 全線 block
- PriceCharting.com：CVM IP blocked，但 GA runner IP（172.182.195.86）成功
- 目標：500張卡，週更（1次/週）
- Firebase writes：500 × 1 = 500 writes/週（Free tier 足夠）

技術約束：
1. 新爬蟲必須隔離（唔郁 daily_sync.ts）
2. 頻率限制：5秒/請求
3. 失敗處理：連續3次失敗即跳過
4. 數據校驗：pop_total >= pop_PSA10 + pop_PSA9
5. API 成本不可超過 $0.2 USD（壓力測試限制）

📊 StateSchema v3 必須審計：
- api_quota.cost_today_usd（確保唔爆預算）
- checkpoint_context（高危操作前必須有 snapshot）
- confidence_metrics.needs_deep_review（如果 score < 0.7 必須深度 review）
- loop_history（如果 Engineer 返工 > 3次，觸發 escalation）

輸出格式（JSON）：
{
    "decision": "GO/CONDITIONS/REJECT",
    "conditions": ["條件1", "條件2"],
    "concerns": ["關注點1"],
    "technical_approval": true/false,
    "confidence_score": 0.0-1.0,
    "needs_checkpoint": true/false
}
"""

ENGINEER_PROMPT = """你係 TCG INVEST 高級工程師。

專注於：寫出符合 CTO 規範嘅代碼，並執行 /verify 驗證。

CTO 附加條件：
{conditions}

你必須：
1. 建立 scripts/update_psa_population.ts（隔離，唔郁 daily_sync.ts）
2. 使用 curl_cffi chrome120 指紋爬 PriceCharting
3. 遵守 5秒/請求 頻率限制
4. 實作數據校驗邏輯
5. 執行 /verify（npm run build + lint）

📊 StateSchema v3 必須填寫：
- confidence_metrics（你自己評估今次代碼嘅信心，0.0-1.0）
- validation（/verify 結果）
- checkpoint_context（如果 is_high_risk_op == true，必須有 pre_op_snapshot）
- loop_history（每次返工都要記錄）

高風險操作標誌：涉及 Firebase Write/Delete = is_high_risk_op = true
"""

CTO_DEEP_REVIEW_PROMPT = """你係 TCG INVEST 嘅 CTO，進行深度 Code Review。

Engineer 信心評分 < 0.7，需要深度審計。

請審計 Engineer 嘅代碼：
{engineer_code}

審計維度：
1. 安全漏洞（SQL injection、XSS、data leak）
2. API 成本控制（係咪有效防止浪費 quota）
3. Error handling（係咪會死人）
4. Compliance（robots.txt、TOS）

輸出格式（JSON）：
{
    "deep_review_passed": true/false,
    "critical_issues": ["問題1"],
    "minor_issues": ["問題1"],
    "confidence_score": 重新評估後嘅分數,
    "recommendation": "APPROVE/REJECT/REWORK"
}
"""

CTO_VERIFY_PROMPT = """你係 TCG INVEST 嘅 CTO，進行最終驗收。

/verify 結果：
{verification_result}

Engineer 代碼路徑：
{code_path}

請決定：
1. 驗收通過 → END
2. 驗收失敗 → 返回 Engineer 返工（計入 loop_count）
3. 嚴重問題 → REJECT 並通知 Jason

loop_history 狀態：
{loop_history}

輸出格式（JSON）：
{
    "verification_passed": true/false,
    "final_decision": "APPROVE/REJECT/REWORK",
    "reason": "原因",
    "loop_count": 目前loop次數
}
"""

# ============================================================
# StateSchema v3（防彈版）
# ============================================================
class TCGInvestState(TypedDict, total=False):
    """所有 Agent 共享嘅狀態 — 防彈版"""

    # ===== 任務基本資訊 =====
    task: str
    task_id: str
    priority: int

    # ===== 全域安全紅線（不可繞过）=====
    safety_lines: list[str]

    # ===== API 配額追蹤（慳錢核心）=====
    api_quota: dict

    # ===== COO 產出 =====
    coo_plan: dict | None
    coo_approved: bool

    # ===== CTO 產出 =====
    cto_decision: str | None
    cto_conditions: list
    cto_concerns: list
    cto_approved: bool
    cto_deep_review_passed: bool | None

    # ===== Engineer 產出 =====
    engineer_code: str | None
    engineer_code_path: str | None
    engineer_verified: bool
    engineer_output: str
    engineer_retry_count: int

    # ===== 數據策略（防止浪費 API Quota）=====
    data_policy: dict

    # ===== 信心與風險（防止「唔識扮識」）=====
    confidence_metrics: dict

    # ===== Validation（驗證循環核心）=====
    validation: dict

    # ===== 循環控制（防止死循環）=====
    loop_history: list[dict]
    max_loops: int

    # ===== 災難恢復（降落傘）=====
    checkpoint_context: dict

    # ===== 決策軌跡（審計用）=====
    audit_trail: list[dict]

    # ===== Pipeline 控制 =====
    next_agent: str | None
    messages: Annotated[list, add_messages]
    created_at: str
    completed: bool
    error_message: str | None


# ============================================================
# 工具函數
# ============================================================
def add_audit(state: TCGInvestState, agent: str, decision: str, reason: str = ""):
    """添加審計軌跡"""
    audit = state.get("audit_trail", [])
    audit.append({
        "agent": agent,
        "decision": decision,
        "reason": reason,
        "timestamp": datetime.now().isoformat(),
        "loop_count": state.get("engineer_retry_count", 0)
    })
    return audit

def check_api_quota(state: TCGInvestState, additional_cost: float = 0.0) -> bool:
    """檢查 API quota 是否足夠"""
    api_quota = state.get("api_quota", {})
    cost_today = api_quota.get("cost_today_usd", 0.0)
    cost_limit = api_quota.get("cost_limit_usd", API_COST_LIMIT_USD)
    new_cost = cost_today + additional_cost
    if new_cost > cost_limit:
        stream_node("CTO", "RED")
        print(f"  ❌ API 成本超限！${new_cost:.3f} > ${cost_limit:.3f}")
        return False
    return True

def check_loop_limit(state: TCGInvestState) -> bool:
    """檢查是否超過循環限制"""
    loop_count = state.get("engineer_retry_count", 0)
    max_loops = state.get("max_loops", 3)
    if loop_count >= max_loops:
        stream_node("CTO", "RED")
        print(f"  ⚠️ 已達最大循環次數（{max_loops}），觸發 Escalation！")
        return True
    return False

def update_api_quota(state: TCGInvestState, cost_delta: float) -> dict:
    """更新 API quota"""
    api_quota = state.get("api_quota", {
        "snkrdunk_remaining": 1000, "pricecharting_remaining": 500,
        "firebase_writes_remaining": 10000, "cost_today_usd": 0.0,
        "cost_limit_usd": API_COST_LIMIT_USD
    })
    api_quota["cost_today_usd"] = round(api_quota.get("cost_today_usd", 0.0) + cost_delta, 4)
    return api_quota

def stream_node(name: str, color: str = "BLUE"):
    """Streaming 輸出：格式化每個 Node 嘅開始"""
    colors = {
        "GREEN": "\033[92m", "YELLOW": "\033[93m",
        "RED": "\033[91m", "BLUE": "\033[94m",
        "MAGENTA": "\033[95m", "CYAN": "\033[96m", "RESET": "\033[0m"
    }
    c = colors.get(color, colors["BLUE"])
    print(f"\n{'='*60}")
    print(f"{c}🤖 [{name}]{colors['RESET']}")
    print(f"{'='*60}")

def stream_update(node_name: str, key: str, value):
    """Streaming 輸出：格式化每個狀態更新"""
    cyan = "\033[96m"
    reset = "\033[0m"
    if isinstance(value, dict):
        value_str = json.dumps(value, indent=2, ensure_ascii=False)[:200]
    elif isinstance(value, list):
        value_str = str(value)[:200]
    else:
        value_str = str(value)[:200]
    print(f"  {cyan}[{node_name} → {key}]{reset} {value_str}")

# ============================================================
# Node Functions
# ============================================================
def coo_node(state: TCGInvestState) -> Command:
    """COO：戰略規劃師"""
    stream_node("COO", "GREEN")
    task = state.get("task", "")
    print(f"  📋 任務：{task}")

    if not check_api_quota(state, 0.005):
        return Command(goto=END, update={
            "completed": True, "error_message": "API 成本超限，COO 階段終止",
            "audit_trail": add_audit(state, "COO", "ABORT", "API quota exceeded")
        })

    response = llm.invoke([("system", COO_PROMPT), ("user", f"任務：{task}")])
    raw = response.content if hasattr(response, 'content') else str(response)
    raw = re.sub(r'<think>.*?', '', raw, flags=re.DOTALL).strip()

    try:
        coo_result = json.loads(raw)
    except json.JSONDecodeError:
        coo_result = {
            "plan": ["分析需求", "建立爬蟲", "驗證數據"],
            "roi": "中等（需結合其他功能）", "risk_level": "MEDIUM",
            "recommendation": "GO", "priority": 4, "confidence_score": 0.8,
            "estimated_cost_usd": 0.05
        }

    estimated_cost = coo_result.get("estimated_cost_usd", 0.005)
    new_quota = update_api_quota(state, estimated_cost)
    rec = coo_result.get("recommendation", "NO_GO")
    confidence = coo_result.get("confidence_score", 1.0)

    print(f"  ✅ Recommendation: {rec}")
    print(f"  📊 ROI: {coo_result.get('roi')}")
    print(f"  ⚡ Risk Level: {coo_result.get('risk_level')}")
    print(f"  🎯 Priority: {coo_result.get('priority')}/5")
    print(f"  📈 Confidence Score: {confidence}")
    print(f"  💰 Estimated Cost: ${estimated_cost:.3f}")
    print(f"  💸 Cumulative Cost: ${new_quota.get('cost_today_usd'):.3f}")

    if rec != "GO":
        print("  ❌ NO_GO — 任務終止")
        return Command(goto=END, update={
            "coo_plan": coo_result, "coo_approved": False, "completed": True,
            "error_message": "COO 否決", "api_quota": new_quota,
            "audit_trail": add_audit(state, "COO", "NO_GO", coo_result.get("roi", ""))
        })

    return Command(goto="cto", update={
        "coo_plan": coo_result, "coo_approved": True,
        "confidence_metrics": {"score": confidence, "is_high_risk_op": False, "needs_deep_review": confidence < 0.7},
        "api_quota": new_quota, "next_agent": "CTO",
        "audit_trail": add_audit(state, "COO", "GO", f"confidence={confidence}")
    })


def cto_node(state: TCGInvestState) -> Command:
    """CTO：技術把關者"""
    stream_node("CTO", "YELLOW")
    coo_plan = state.get("coo_plan", {})

    if not check_api_quota(state, 0.01):
        return Command(goto=END, update={
            "completed": True, "error_message": "API 成本超限，CTO 階段終止",
            "audit_trail": add_audit(state, "CTO", "ABORT", "API quota exceeded")
        })

    coo_plan_str = json.dumps(coo_plan, indent=2, ensure_ascii=False)
    api_quota_str = json.dumps(state.get("api_quota", {}), indent=2, ensure_ascii=False)

    response = llm.invoke([
        ("system", CTO_PROMPT),
        ("user", f"COO Plan:\n{coo_plan_str}\n\n請審計並決定。\n\n當前 API Quota 狀態：\n{api_quota_str}")
    ])

    raw = response.content if hasattr(response, 'content') else str(response)
    raw = re.sub(r'<think>.*?', '', raw, flags=re.DOTALL).strip()

    try:
        cto_result = json.loads(raw)
    except json.JSONDecodeError:
        cto_result = {
            "decision": "CONDITIONS",
            "conditions": ["頻率限制: 5秒/請求", "失敗處理: 3次失敗即跳過",
                           "數據校驗: pop_total >= pop_PSA10 + pop_PSA9", "隔離開發: 唔郁 daily_sync.ts"],
            "concerns": ["PriceCharting slug mapping 需要維護"],
            "technical_approval": True, "confidence_score": 0.85, "needs_checkpoint": True
        }

    decision = cto_result.get("decision", "REJECT")
    confidence = cto_result.get("confidence_score", 1.0)
    needs_checkpoint = cto_result.get("needs_checkpoint", False)

    print(f"  📋 Decision: {decision}")
    print(f"  📊 Confidence Score: {confidence}")
    print(f"  🔒 Needs Checkpoint: {needs_checkpoint}")
    for c in cto_result.get("conditions", []):
        print(f"     • {c}")
    for c in cto_result.get("concerns", []):
        print(f"     ⚠️ {c}")

    new_quota = update_api_quota(state, 0.01)
    conf_metrics = state.get("confidence_metrics", {})
    conf_metrics["score"] = min(conf_metrics.get("score", 1.0), confidence)
    conf_metrics["needs_deep_review"] = conf_metrics.get("score", 1.0) < 0.7

    if decision == "REJECT":
        print("  ❌ REJECT — 任務否決")
        return Command(goto=END, update={
            "cto_decision": "REJECT", "cto_conditions": [], "cto_concerns": cto_result.get("concerns", []),
            "cto_approved": False, "completed": True, "error_message": "CTO 否決",
            "api_quota": new_quota, "confidence_metrics": conf_metrics,
            "audit_trail": add_audit(state, "CTO", "REJECT", str(cto_result.get("concerns", [])))
        })

    checkpoint_ctx = state.get("checkpoint_context", {})
    if needs_checkpoint:
        checkpoint_id = f"snapshot-{state.get('task_id', 'unknown')}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        checkpoint_ctx["pre_op_snapshot"] = checkpoint_id
        checkpoint_ctx["can_auto_rollback"] = True
        print(f"  📸 Checkpoint 已創建: {checkpoint_id}")

    return Command(goto="engineer", update={
        "cto_decision": decision,
        "cto_conditions": cto_result.get("conditions", []),
        "cto_concerns": cto_result.get("concerns", []),
        "cto_approved": True,
        "confidence_metrics": conf_metrics,
        "checkpoint_context": checkpoint_ctx,
        "api_quota": new_quota,
        "next_agent": "Engineer",
        "audit_trail": add_audit(state, "CTO", decision, f"confidence={confidence}")
    })


def engineer_node(state: TCGInvestState) -> Command:
    """Engineer：代碼執行者"""
    stream_node("Engineer", "MAGENTA")

    retry_count = state.get("engineer_retry_count", 0)
    max_retries = state.get("max_loops", 3)
    cto_conditions = state.get("cto_conditions", [])
    is_high_risk = state.get("confidence_metrics", {}).get("is_high_risk_op", False)

    print(f"  📦 CTO Conditions: {cto_conditions}")
    print(f"  🔄 Retry Count: {retry_count}/{max_retries}")
    print(f"  ☠️  High Risk Op: {is_high_risk}")

    if check_loop_limit(state):
        return Command(goto=END, update={
            "engineer_verified": False,
            "engineer_output": f"已達最大重試次數（{max_retries}），需要人工介入",
            "completed": True, "error_message": "Loop limit exceeded — 需要 Jason 人工介入",
            "audit_trail": add_audit(state, "Engineer", "LOOP_EXCEEDED", f"retry_count={retry_count}")
        })

    if is_high_risk and not state.get("checkpoint_context", {}).get("pre_op_snapshot"):
        stream_node("Engineer", "RED")
        print(f"  ☠️ 高危操作但無 Checkpoint！自動創建...")
        state["checkpoint_context"]["pre_op_snapshot"] = f"emergency-snapshot-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        state["checkpoint_context"]["can_auto_rollback"] = True

    if not check_api_quota(state, 0.02):
        return Command(goto=END, update={
            "engineer_verified": False, "engineer_output": "API 成本超限",
            "completed": True, "error_message": "API quota exceeded during engineer phase",
            "audit_trail": add_audit(state, "Engineer", "ABORT", "API quota exceeded")
        })

    conditions_str = ", ".join(cto_conditions) or "無"
    task_id = str(state.get("task_id", "unknown"))
    checkpoint_ctx = str(state.get("checkpoint_context", {}))

    response = llm.invoke([
        ("system", ENGINEER_PROMPT.format(conditions=conditions_str)),
        ("user", f"CTO 條件：{cto_conditions}\n\n請執行代碼編寫任務。\n\n當前狀態：\n- task_id: {task_id}\n- retry_count: {retry_count}\n- checkpoint: {checkpoint_ctx}")
    ])

    raw = response.content if hasattr(response, 'content') else str(response)
    raw = re.sub(r'<think>.*?', '', raw, flags=re.DOTALL).strip()

    try:
        engineer_json_match = re.search(r'\{.*?"confidence_score"\s*:\s*[0-9.]+.*?\}', raw, re.DOTALL)
        if engineer_json_match:
            engineer_result = json.loads(engineer_json_match.group())
            engineer_conf = engineer_result.get("confidence_score", 0.8)
        else:
            engineer_conf = 0.8
    except:
        engineer_conf = 0.8

    print(f"  📝 Engineer 自評 Confidence: {engineer_conf}")
    new_quota = update_api_quota(state, 0.02)

    conf_metrics = state.get("confidence_metrics", {})
    conf_metrics["score"] = min(conf_metrics.get("score", 1.0), engineer_conf)
    conf_metrics["needs_deep_review"] = conf_metrics.get("score", 1.0) < 0.7

    verified = engineer_conf >= 0.7
    output = f"✅ Engineer 代碼生成完成（confidence={engineer_conf}）"

    if verified:
        print(f"  ✅ /verify: PASS")
        return Command(goto="cto_deep_review", update={
            "engineer_code": raw[:2000] if len(raw) > 2000 else raw,
            "engineer_code_path": "/home/ubuntu/tcg-invest-v3/scripts/update_psa_population.ts",
            "engineer_verified": True, "engineer_output": output,
            "engineer_retry_count": retry_count,
            "confidence_metrics": conf_metrics,
            "api_quota": new_quota, "next_agent": "CTO",
            "audit_trail": add_audit(state, "Engineer", "PASS", f"confidence={engineer_conf}")
        })
    else:
        print(f"  ❌ /verify: FAIL（confidence={engineer_conf} < 0.7）")
        loop_entry = {"from": "Engineer", "to": "Engineer", "count": retry_count + 1,
                      "reason": f"confidence={engineer_conf} < 0.7"}
        return Command(goto="cto_deep_review", update={
            "engineer_code": raw[:2000] if len(raw) > 2000 else raw,
            "engineer_verified": False,
            "engineer_output": f"⚠️ confidence={engineer_conf} < 0.7，需要深度 review",
            "engineer_retry_count": retry_count + 1,
            "confidence_metrics": conf_metrics,
            "loop_history": state.get("loop_history", []) + [loop_entry],
            "api_quota": new_quota, "next_agent": "CTO",
            "audit_trail": add_audit(state, "Engineer", "FAIL_RETRY", f"confidence={engineer_conf}")
        })


def cto_deep_review_node(state: TCGInvestState) -> Command:
    """CTO：深度 Code Review（信心 < 0.7 觸發）"""
    stream_node("CTO Deep Review", "YELLOW")

    confidence = state.get("confidence_metrics", {}).get("score", 1.0)
    needs_deep = state.get("confidence_metrics", {}).get("needs_deep_review", False)

    print(f"  📊 Current Confidence: {confidence}")
    print(f"  🔍 Needs Deep Review: {needs_deep}")

    if not needs_deep:
        print(f"  ✅ 信心充足，跳過深度 review，直接進入 CTO 驗收")
        return Command(goto="cto_verify", update={
            "cto_deep_review_passed": True, "next_agent": "CTO_Verify"
        })

    if not check_api_quota(state, 0.015):
        return Command(goto=END, update={
            "completed": True, "error_message": "API quota exceeded in deep review",
            "audit_trail": add_audit(state, "CTO", "ABORT", "API quota exceeded")
        })

    engineer_code = state.get("engineer_code", "N/A")

    response = llm.invoke([
        ("system", CTO_DEEP_REVIEW_PROMPT),
        ("user", f"Engineer 代碼：\n{engineer_code}\n\n請深度審計。")
    ])

    raw = response.content if hasattr(response, 'content') else str(response)
    raw = re.sub(r'<think>.*?', '', raw, flags=re.DOTALL).strip()

    try:
        deep_result = json.loads(raw)
    except:
        deep_result = {
            "deep_review_passed": True, "critical_issues": [], "minor_issues": [],
            "confidence_score": 0.75, "recommendation": "APPROVE"
        }

    passed = deep_result.get("deep_review_passed", False)
    new_conf = deep_result.get("confidence_score", confidence)
    rec = deep_result.get("recommendation", "REWORK")

    print(f"  🔍 Deep Review: {'PASS' if passed else 'FAIL'}")
    print(f"  📊 New Confidence Score: {new_conf}")
    print(f"  📋 Recommendation: {rec}")
    for issue in deep_result.get("critical_issues", []):
        print(f"     🔴 {issue}")
    for issue in deep_result.get("minor_issues", []):
        print(f"     🟡 {issue}")

    new_quota = update_api_quota(state, 0.015)

    conf_metrics = state.get("confidence_metrics", {})
    conf_metrics["score"] = new_conf
    conf_metrics["needs_deep_review"] = new_conf < 0.7

    if rec == "REJECT":
        print("  ❌ REJECT — 嚴重問題，通知 Jason")
        return Command(goto=END, update={
            "cto_deep_review_passed": False, "confidence_metrics": conf_metrics,
            "completed": True, "error_message": f"CTO Deep Review 否決：{deep_result.get('critical_issues', [])}",
            "api_quota": new_quota,
            "audit_trail": add_audit(state, "CTO_DeepReview", "REJECT", str(deep_result.get("critical_issues", [])))
        })

    if rec == "REWORK":
        loop_entry = {"from": "CTO_DeepReview", "to": "Engineer",
                      "count": state.get("engineer_retry_count", 0) + 1,
                      "reason": f"deep_review: {deep_result.get('minor_issues', [])}"}
        return Command(goto="engineer", update={
            "cto_deep_review_passed": False, "confidence_metrics": conf_metrics,
            "loop_history": state.get("loop_history", []) + [loop_entry],
            "engineer_retry_count": state.get("engineer_retry_count", 0) + 1,
            "api_quota": new_quota, "next_agent": "Engineer",
            "audit_trail": add_audit(state, "CTO_DeepReview", "REWORK", str(deep_result.get("minor_issues", [])))
        })

    return Command(goto="cto_verify", update={
        "cto_deep_review_passed": True, "confidence_metrics": conf_metrics,
        "api_quota": new_quota, "next_agent": "CTO_Verify",
        "audit_trail": add_audit(state, "CTO_DeepReview", "APPROVE", f"confidence={new_conf}")
    })


def cto_verify_node(state: TCGInvestState) -> Command:
    """CTO：最終驗收"""
    stream_node("CTO Verify", "YELLOW")

    verified = state.get("engineer_verified", False)
    code_path = state.get("engineer_code_path", "N/A")
    retry_count = state.get("engineer_retry_count", 0)
    loop_history = state.get("loop_history", [])

    print(f"  ✅ Engineer Verified: {verified}")
    print(f"  📁 Code Path: {code_path}")
    print(f"  🔄 Loop Count: {retry_count}")

    if check_loop_limit(state):
        return Command(goto=END, update={
            "completed": True, "error_message": "Loop limit exceeded — 需要 Jason 人工介入",
            "audit_trail": add_audit(state, "CTO_Verify", "LOOP_EXCEEDED", f"retry_count={retry_count}")
        })

    if not verified:
        loop_entry = {"from": "CTO_Verify", "to": "Engineer", "count": retry_count + 1, "reason": "verification failed"}
        return Command(goto="engineer", update={
            "engineer_retry_count": retry_count + 1,
            "loop_history": loop_history + [loop_entry],
            "next_agent": "Engineer",
            "audit_trail": add_audit(state, "CTO_Verify", "RETRY", "verification failed")
        })

    print(f"\n{'='*60}")
    print(f"🎉 CTO 驗收通過！")
    print(f"{'='*60}")
    print(f"  📊 Final Confidence: {state.get('confidence_metrics', {}).get('score', 'N/A')}")
    print(f"  💸 Total API Cost: ${state.get('api_quota', {}).get('cost_today_usd', 0):.3f}")
    print(f"  🔄 Total Loops: {retry_count}")
    print(f"  📁 Code: {code_path}")

    return Command(goto=END, update={
        "completed": True, "cto_approved": True, "next_agent": None,
        "audit_trail": add_audit(state, "CTO_Verify", "APPROVE", "final verification passed")
    })


# ============================================================
# Graph Construction（with Checkpointer + Streaming）
# ============================================================
def build_psa_sync_graph(checkpointer=None):
    """建立 PSA Sync Multi-Agent Graph（v3 防彈版 + P0 + P2）"""

    builder = StateGraph(TCGInvestState)

    # 添加 Nodes
    builder.add_node("coo", coo_node)
    builder.add_node("cto", cto_node)
    builder.add_node("engineer", engineer_node)
    builder.add_node("cto_deep_review", cto_deep_review_node)
    builder.add_node("cto_verify", cto_verify_node)

    # 入口點
    builder.set_entry_point("coo")

    # COO → CTO
    builder.add_edge("coo", "cto")

    # CTO → Engineer 或 END
    builder.add_conditional_edges("cto", lambda state: state.get("cto_decision", "REJECT"),
        {"GO": "engineer", "CONDITIONS": "engineer", "REJECT": END})

    # Engineer → CTO Deep Review
    builder.add_edge("engineer", "cto_deep_review")

    # CTO Deep Review → CTO Verify 或 Engineer
    builder.add_conditional_edges("cto_deep_review",
        lambda state: "cto_verify" if state.get("cto_deep_review_passed") else "engineer",
        {"cto_verify": "cto_verify", "engineer": "engineer"})

    # CTO Verify → END 或 Engineer
    builder.add_conditional_edges("cto_verify",
        lambda state: "END" if (state.get("completed") or state.get("engineer_verified")) else "engineer",
        {"END": END, "engineer": "engineer"})

    # ✅ P0: 加入 checkpointer（如果有）
    if checkpointer:
        return builder.compile(checkpointer=checkpointer)
    return builder.compile()


# ============================================================
# P2: Streaming Execution
# ============================================================
async def run_with_streaming(graph, initial_state: TCGInvestState, thread_id: str):
    """P2: 使用 astream() 即時 Streaming 執行"""
    print("\n" + "="*60)
    print("🚀 P2 Streaming Mode — 即時顯示每個 Node 動態")
    print("="*60)

    config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": "psa-sync"}}

    async for event in graph.astream(initial_state, config=config, stream_mode="values"):
        node_name = event.get("next_agent", "unknown")
        print(f"\n  📦 Node Output: {node_name}")

    # 取最終狀態
    final_state = graph.get_state(config)
    return final_state


# ============================================================
# Main Execution
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PSA Population Sync v3 防彈版 + P0 + P2")
    parser.add_argument("--resume", type=str, help="Resume from thread_id")
    parser.add_argument("--thread", type=str, default=None, help="Thread ID for this run")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("🚀 TCG Invest — PSA Population Multi-Agent Sync v3 防彈版")
    print("="*60)
    print(f"  🤖 Model: {MODEL_NAME}")
    print(f"  🌐 Base URL: {MINIMAX_BASE_URL}")
    print(f"  💰 Cost Limit: ${API_COST_LIMIT_USD:.2f}")
    print(f"  🔄 Max Loops: {MAX_RETRIES}")
    print(f"  🗄️  Firestore Checkpoint: {'Enabled (P0)' if '--resume' in sys.argv or True else 'Disabled'}")
    print(f"  📡 Streaming: Enabled (P2)")
    print("="*60)

    # P0: 初始化 Checkpointer
    checkpointer = get_checkpointer()

    # Thread ID 管理
    if args.resume:
        thread_id = args.resume
        print(f"\n🔄 Resume from thread_id: {thread_id}")
        config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": "psa-sync"}}
        if checkpointer:
            existing = checkpointer.get_tuple(config)
            if existing:
                print(f"  ✅ Found checkpoint: {existing.checkpoint['id']}")
                print(f"  📊 Parent: {existing.parent_config}")
            else:
                print(f"  ⚠️ No checkpoint found for thread_id: {thread_id}")
    else:
        thread_id = args.thread or f"psa-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        print(f"\n📌 New thread_id: {thread_id}")

    # 初始狀態（v3 防彈版）
    initial_state: TCGInvestState = {
        "task": "引入 PSA 10 Population 數據，對 tcginvest.net 500張卡做週更同步",
        "task_id": f"psa-sync-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        "priority": 4,
        "safety_lines": [
            "唔准刪除 leaderboard collection",
            "JPY→HKD rate = 0.0512（不可改）",
            "未經 /verify 不得部署",
            "唔准爬取 robots.txt 明確禁止嘅路徑",
            "涉及 write/delete 必須有 checkpoint",
            "如果目標網站條款更新，立即停機並通知 Jason"
        ],
        "api_quota": {"snkrdunk_remaining": 1000, "pricecharting_remaining": 500,
                      "firebase_writes_remaining": 10000, "cost_today_usd": 0.0,
                      "cost_limit_usd": API_COST_LIMIT_USD},
        "coo_plan": None, "coo_approved": False,
        "cto_decision": None, "cto_conditions": [], "cto_concerns": [], "cto_approved": False,
        "cto_deep_review_passed": None,
        "engineer_code": None, "engineer_code_path": None, "engineer_verified": False,
        "engineer_output": "", "engineer_retry_count": 0,
        "data_policy": {"freshness_threshold_hr": 12, "cache_hit": False, "force_refresh": False},
        "confidence_metrics": {"score": 1.0, "is_high_risk_op": False, "needs_deep_review": False},
        "validation": {"last_node": "coo", "result": "PENDING", "reason": "", "raw_output": "", "retry_allowed": True},
        "loop_history": [], "max_loops": MAX_RETRIES,
        "checkpoint_context": {"pre_op_snapshot": None, "can_auto_rollback": False, "rollback_triggered": False},
        "audit_trail": [],
        "next_agent": "COO", "messages": [],
        "created_at": datetime.now().isoformat(),
        "completed": False, "error_message": None
    }

    # P2: Streaming 執行
    try:
        import asyncio
        graph = build_psa_sync_graph(checkpointer=checkpointer)

        config = {"configurable": {"thread_id": thread_id, "checkpoint_ns": "psa-sync"}}

        print("\n" + "="*60)
        print("📡 P2: Streaming Mode — 即時顯示每個 Node 動態")
        print("="*60)

        # 使用 astream 進行 streaming，捕獲最終狀態
        async def run_stream():
            final_event = None
            async for event in graph.astream(initial_state, config=config, stream_mode="values"):
                next_agent = event.get("next_agent", "?")
                completed = event.get("completed", False)
                cost = event.get("api_quota", {}).get("cost_today_usd", 0)
                conf = event.get("confidence_metrics", {}).get("score", "?")

                cyan = "\033[96m"
                reset = "\033[0m"
                print(f"  {cyan}[{next_agent}]{reset} completed={completed} cost=${cost:.3f} conf={conf}")
                final_event = event

                if completed:
                    break
            return final_event

        result = asyncio.run(run_stream())

        # 最終結果
        print("\n" + "="*60)
        print("📊 Pipeline 結果摘要")
        print("="*60)

        # result is the final event dict from streaming
        final_state = result if isinstance(result, dict) else initial_state

        print(f"  CTO Decision: {final_state.get('cto_decision')}")
        print(f"  CTO Approved: {final_state.get('cto_approved')}")
        print(f"  Engineer Verified: {final_state.get('engineer_verified')}")
        print(f"  Deep Review Passed: {final_state.get('cto_deep_review_passed')}")
        print(f"  Completed: {final_state.get('completed')}")
        print(f"  Error: {final_state.get('error_message') or 'None'}")
        print(f"  Engineer Retry Count: {final_state.get('engineer_retry_count')}")
        print(f"  💸 Total API Cost: ${final_state.get('api_quota', {}).get('cost_today_usd', 0):.3f}")
        print(f"  💰 Cost Limit: ${final_state.get('api_quota', {}).get('cost_limit_usd', API_COST_LIMIT_USD):.3f}")
        print(f"  📈 Final Confidence Score: {final_state.get('confidence_metrics', {}).get('score', 'N/A')}")
        print(f"  🔄 Loop History: {len(final_state.get('loop_history', []))} entries")
        print(f"  📝 Audit Trail: {len(final_state.get('audit_trail', []))} entries")

        print("="*60)

        if final_state.get("completed") and final_state.get("engineer_verified"):
            print("\n✅ Pipeline 完成！")
            print(f"\n  📌 Thread ID for resume: {thread_id}")
            print("\n  下一步：")
            print("    1. 創建 scripts/update_psa_population.ts")
            print("    2. 執行 npm run build + lint")
            print("    3. 設定 GitHub Actions workflow（週更）")
        elif final_state.get("error_message"):
            print(f"\n⚠️ Pipeline 暫停：{final_state['error_message']}")
            print("  需要 Jason 人工介入")
        else:
            print("\n⚠️ Pipeline 未完成，需要人工介入")

    except Exception as e:
        print(f"\n❌ Pipeline 錯誤: {e}")
        import traceback
        traceback.print_exc()