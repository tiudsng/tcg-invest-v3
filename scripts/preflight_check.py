#!/usr/bin/env python3
"""
Pre-flight Check — TCG Invest Multi-Agent v3 防彈版
執行壓力測試前嘅環境驗證

使用方法：python scripts/preflight_check.py
"""

import os
import sys
import json
from datetime import datetime

# 顏色輸出
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def check(name: str, passed: bool, detail: str = ""):
    icon = f"{GREEN}✅{RESET}" if passed else f"{RED}❌{RESET}"
    print(f"  {icon} {name}")
    if detail:
        print(f"     {detail}")
    return passed

def section(name: str):
    print(f"\n{BLUE}── {name} ──{RESET}")

# ============================================================
# 1. Python 依賴檢查
# ============================================================
section("Python 依賴")

deps = {
    "langgraph": "langgraph",
    "langchain_openai": "langchain-openai",
    "curl_cffi": "curl_cffi",
    "google.cloud.firestore": "google-cloud-firestore",
    "pydantic": "pydantic"
}

all_deps_ok = True
for module_name, package_name in deps.items():
    try:
        __import__(module_name)
        check(f"{package_name}", True)
    except ImportError:
        check(f"{package_name}", False, f"需要: pip install {package_name}")
        all_deps_ok = False

# ============================================================
# 2. API Key 配置檢查
# ============================================================
section("API Key 配置")

api_keys = {
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
    "OPENAI_API_KEY_2": os.getenv("OPENAI_API_KEY_2")
}

has_any_key = False
for key_name, key_value in api_keys.items():
    if key_value:
        check(f"{key_name}", True, f"已設置 ({len(key_value)} chars)")
        has_any_key = True
    else:
        check(f"{key_name}", False, "未設置")

if not has_any_key:
    print(f"\n  {RED}⚠️  警告：沒有 OPENAI API Key，Pipeline 無法運行{RESET}")

# ============================================================
# 3. Firebase 配置檢查
# ============================================================
section("Firebase 配置")

# 檢查 SA JSON
sa_path = "/home/ubuntu/tcg-invest-v3/firebase-admin-sa.json"
if os.path.exists(sa_path):
    try:
        with open(sa_path) as f:
            sa_data = json.load(f)
        check("firebase-admin-sa.json", True, f"project: {sa_data.get('project_id', 'N/A')}")
    except Exception as e:
        check("firebase-admin-sa.json", False, f"解析失敗: {e}")
else:
    check("firebase-admin-sa.json", False, "檔案不存在")

# 檢查 Vercel env var
vercel_sa = os.getenv("FIREBASE_ADMIN_SA_JSON")
if vercel_sa:
    check("FIREBASE_ADMIN_SA_JSON (Vercel)", True, f"已設置 ({len(vercel_sa)} chars)")
else:
    check("FIREBASE_ADMIN_SA_JSON (Vercel)", False, "未設置")

# ============================================================
# 4. 現有 Script 狀態檢查
# ============================================================
section("現有 Script 狀態")

scripts = [
    "/home/ubuntu/tcg-invest-v3/scripts/langgraph_psa_sync.py",
    "/home/ubuntu/tcg-invest-v3/scripts/update_psa_population.ts",
    "/home/ubuntu/tcg-invest-v3/daily_sync.ts"
]

for script in scripts:
    if os.path.exists(script):
        size = os.path.getsize(script)
        check(os.path.basename(script), True, f"{size} bytes")
    else:
        check(os.path.basename(script), False, "不存在")

# ============================================================
# 5. StateSchema v3 完整性檢查
# ============================================================
section("StateSchema v3 完整性")

v3_fields = [
    "safety_lines",
    "api_quota",
    "coo_plan",
    "cto_decision",
    "engineer_code",
    "data_policy",
    "confidence_metrics",
    "validation",
    "loop_history",
    "checkpoint_context",
    "audit_trail"
]

schema_file = "/home/ubuntu/.hermes/skills/hermes-multi-agent/templates/langgraph_base.py"
if os.path.exists(schema_file):
    with open(schema_file) as f:
        schema_content = f.read()

    all_fields_found = True
    for field in v3_fields:
        if f'"{field}"' in schema_content or f"'{field}'" in schema_content:
            check(f"State field: {field}", True)
        else:
            check(f"State field: {field}", False, "未找到")
            all_fields_found = False
else:
    print(f"  {RED}❌ langgraph_base.py 不存在{RESET}")
    all_fields_found = False

# ============================================================
# 6. Safety Lines 配置檢查
# ============================================================
section("Safety Lines 配置")

legal_lines = [
    "robots.txt",
    "JPY→HKD",
    "唔准刪除 leaderboard"
]

if os.path.exists(schema_file):
    with open(schema_file) as f:
        safety_content = f.read()

    for line in legal_lines:
        if line in safety_content:
            check(f"Safety Line: {line}", True)
        else:
            check(f"Safety Line: {line}", False, "未找到")

# ============================================================
# 7. GitHub 狀態
# ============================================================
section("Git 狀態")

try:
    import subprocess
    result = subprocess.run(
        ["git", "-C", "/home/ubuntu/tcg-invest-v3", "status", "--short"],
        capture_output=True,
        text=True,
        timeout=5
    )
    if result.returncode == 0:
        changes = result.stdout.strip()
        if changes:
            check("Git working tree", False, "有待提交更改")
            print(f"     {changes[:200]}")
        else:
            check("Git working tree", True, "clean")
except Exception as e:
    check("Git status", False, str(e))

# ============================================================
# 8. 預估成本計算
# ============================================================
section("預估成本（$0.2 USD limit）")

cards_to_test = 10
api_cost_per_card = 0.005  # 假設每次 API call $0.005

estimated_cost = cards_to_test * api_cost_per_card
check("測試卡片數量", True, f"{cards_to_test} 張")
check("預估 API 成本", True, f"${estimated_cost:.3f} USD")

if estimated_cost <= 0.2:
    check("預估成本 <= $0.2", True, "✅ 可以執行")
else:
    check("預估成本 <= $0.2", False, "⚠️ 超出預算")

# ============================================================
# 總結
# ============================================================
section("Pre-flight 總結")

print(f"""
{GREEN}✅ 環境檢查完成{RESET}

如果所有檢查都通過，你可以執行：

  cd /home/ubuntu/tcg-invest-v3
  export OPENAI_API_KEY='your-key-here'
  python scripts/langgraph_psa_sync.py

{RESET}如果是第一次運行，强烈建議先做 Dry-run：

  python scripts/langgraph_psa_sync.py --dry-run

{RESET}如需查看完整日誌：

  python scripts/langgraph_psa_sync.py 2>&1 | tee /tmp/psa_sync.log
""")

if all_deps_ok and has_any_key:
    print(f"{GREEN}🎉 所有關鍵檢查通過，可以開始執行！{RESET}")
else:
    print(f"{YELLOW}⚠️ 部分檢查失敗，請先修復後再執行{RESET}")