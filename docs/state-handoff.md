# Session Handoff — tcginvest.net

## 📅 Last Updated
2026-05-14 14:XX HKT

---

## ✅ 完成進度

### 卡牌詳情頁修復（2026-05-14）
- **問題**：點擊排行榜卡片顯示「找不到此卡片資料」
- **根本原因**：`pokeca_gold` doc ID 是 numeric（`120746`），URL slug 是 `snkrdunk_146897`，兩者不匹配
- **解決方案**：改用 `leaderboard` collection by `snkrdunk_id` query 作為 SSOT
- **變更檔案**：
  - `src/ProductDetail.tsx` — leaderboard 查詢 + 數據 transform
  - `src/components/PriceLeaderboard.tsx` — navigate 改用 `card.card_id`
- **驗證**：✅ `/product/snkrdunk_146897` 顯示卡名、價格、PSA統計
- **部署**：tcg-invest-v3-1xyk3kqiz → www.tcginvest.net

### TCG OPERATION MENU（2026-05-14）
- **創建**：`~/.hermes/skills/tcginvest/tcg-operation-menu/SKILL.md`
- **內容**：部署、Firebase、卡牌數據架構、爬蟲反爬、Arch Guardian 健康度

### Hermès Agentic Harness（2026-05-14）
- **創建**：`~/.hermes/skills/hermes-agentic-harness/SKILL.md`
- **內容**：Auto-Loop Rule、/verify、/codex-review、/handoff、一人多身份模式

### AGENTS.md（2026-05-14）
- **創建**：`/home/ubuntu/tcg-invest-v3/AGENTS.md`
- **內容**：身份定義、運行規則、ID系統、紅線、Session Handoff Protocol

---

## 🧭 問導師機制（2026-05-14 新增）

### Consult-CTO Rule
- **觸發**：涉及金錢計算、API 邊界設計、爬蟲頻率調整、數據庫 Schema 變動
- **Protocol**：必須停止自主決策，調用 `/consult-cto` 技能
- **Authority**：CTO 回覆具備最高優先級，否決方案必須絕對服從

### Handoff Metadata
```json
{
  "Consultation_Pending": false,
  "CTO_Decision_Log": [
    {
      "timestamp": "2026-05-14",
      "decision": "...",
      "context": "..."
    }
  ]
}
```

### 關鍵決策記錄
| 日期 | 決策 | 背景 |
|------|------|------|
| 2026-05-14 | 固化「問導師」機制 | Jason 要求所有問題先問導師直至最後微調 |

---

## 🔄 待處理任務

### 高優先級
| Task | 狀態 | Blocker |
|------|------|---------|
| PriceTrend chart HTTP 404 | 待修復 | pokeca-chart API 需要登入或不存在（非關鍵） |
| JPY→HKD rate 0.052 衝突 | 待統一 | 14+ 個 script files 使用錯誤值 0.052 |

### 中優先級
| Task | 狀態 | Blocker |
|------|------|---------|
| 爬蟲腳本重疊清理（97.3% 重疊） | 待規劃 | 需要 Jason 確認保留版本 |
| `tcg_invest_utils.cjs` 整合 | 待評估 | 未被任何 script 引用 |

### 低優先級
| Task | 狀態 | Blocker |
|------|------|---------|
| `omni_scraper_base.py` | 未實現 | 需重新評估需求 |
| Arch Guardian 健康度 51/100 | 待改善 | 腳本重疊問題先處理 |

---

## 📊 關鍵狀態

### Firebase
- **project_id**: `gen-lang-client-0326385388`
- **database_id**: `ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b`
- **collections**: `leaderboard`, `pokeca_gold`, `new_products`
- **SA**: `firebase-admin-sa.json`（本地），`FIREBASE_ADMIN_SA_JSON`（Vercel）

### 部署
- **當前部署**: `tcg-invest-v3-1xyk3kqiz`
- **URL**: www.tcginvest.net
- **Vercel token**: [REDACTED — see Vercel project settings]

### 爬蟲
- **JPY→HKD rate**: `0.0512`
- **GA Runner IP**: `172.182.195.86`（乾淨，可爬 PriceCharting）
- **CVM IP**: 全部被 Cloudflare block

### GitHub
- **Repo**: `tiudsng/tcg-invest-v3`
- **最新 commit**: `c09c4cf` — fix: use leaderboard as SSOT for card details

---

## 🧠 經驗記錄（Lessons Learned）

1. **Vercel ENOTEMPTY**：用 prebuilt deployment 繞過
2. **Firebase dual ID**：project_id ≠ database_id
3. **三種 ID 系統**：URL slug / Firestore doc / snkrdunk_id
4. **Route 順序**：middleware 必須在 route 之前
5. **CVM IP 被封**：全部 Cloudflare 站點，GA runner IP 先得

---

## 📁 相關檔案

- `AGENTS.md` — Agent 身份與運行規則
- `docs/state-handoff.md` — 本文件
- `feature_list.json` — TCG 卡牌抓取進度
- `~/.hermes/skills/hermes-agentic-harness/SKILL.md` — 行動指南
- `~/.hermes/skills/tcginvest/tcg-operation-menu/SKILL.md` — 運維經驗

---

*下次 Session 開始時，請先閱讀本文件以無縫接軌。*