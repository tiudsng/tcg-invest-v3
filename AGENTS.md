# TCG Invest Manager - Agent 操作手冊

## 🤖 Telegram Bot 功能與指令
本專案整合了 Telegraf 機器人，支援以下特殊指令，Agent 在維護時應確保這些邏輯不被破壞。

### 1. 排行榜管理
*   **`/updateleaderboard`**: 觸發 `src/lib/leaderboardService.ts` 中的 `syncLeaderboard` 函數。
    *   **邏輯**：抓取 `config/leaderboard` 的設定 -> 讀取 `pokeca_gold` 集合的大圖 -> 呼叫 Gemini AI 分析市場 -> 更新 `leaderboard` 集合中的個別 `rank_XX` 文檔。
*   **`/setranks <ID1> <ID2>...`**: 動態設定排行榜順序。
    *   **參數**：需傳入以 `snkrdunk_` 開頭的 ID。
    *   **儲存位置**：Firestore `config/leaderboard` 文檔中的 `rankings` 陣列。
*   **`/switch <Num1> <Num2>`**: 交換排行榜中的兩個位置（例如 `/switch 1 2`）。
    *   **邏輯**：直接交換 `leaderboard` 集合中對應 `rank_XX` 文檔的內容。

### 2. 文章與 AI 管理
*   **「官方目錄結果 (0)」自動追蹤**: 
    *   當用戶在搜尋頁面搜尋不到結果時，系統會自動在後台透過 `src/lib/snkrdunkSearchService.ts` 抓取 Snkrdunk 官網。
    *   若發現相關卡片，會透過 Telegram Bot 發送通知（需配置 `ADMIN_CHAT_ID`）。
    *   通知會包含 Snkrdunk ID 與 連結，方便 Agent 使用 `/setranks` 解析並加入目錄。
*   **`/listArticles`**: 列出 `articles` 集合中最前 10 篇文。
*   **`/deleteArticle <docId>`**: 刪除指定文章。
*   **AI 關鍵字監聽 (OpenClaw/小龍蝦)**: 
    *   當訊息包含「小龍蝦」或「OpenClaw」時，觸發 Gemini 進行分析。
    *   可以產出 JSON 指令自動在後台發佈 `post_article` 到文章區。

## 📁 核心檔案結構
*   `server.ts`: 啟動入口，負責調用 `src/bot.ts` 的 `startBot()`。
*   `src/bot.ts`: 機器人主邏輯，包含所有指令定義與 Webhook/Polling 管理。
*   `src/lib/leaderboardService.ts`: 核心同步引擎。

## ⚠️ 開發注意事項
1. **409 Conflict**: 已在 `startBot` 中實作 `deleteWebhook` 與重試邏輯，避免重啟時衝突。
2. **圖片優先權**：排行榜圖片優先讀取 `pokeca_gold` / `new_products` 集合，其次才是 `baselineData` 的 fallback URL。

## 📥 爬蟲與資料庫寫入規範 (CRITICAL)
AGENT 每次爬取或更新價格資料時，**必須**遵守以下規則，避免遺忘或破壞架構：

### 1. 資料庫卡片格式統一規範
寫入 `pokeca_gold` 和 `new_products` 集合的卡片資訊必須維持乾淨結構：
*   **`name`**: 卡片乾淨名稱，不含稀有度後綴 (例如: "Mew ex", 不要有 SAR/SR)。
*   **`set_name`**: 乾淨的系列名稱 (例如: "Shiny Treasure ex")。
*   **`set_code`**: 系列代號 (例如: "SV4a")。
*   **`card_number`**: 精準卡號 (例如: "347/190")。
*   **`display` / `name_zh`**: 統一顯示字串，格式強制為 `${name} ${set_code} ${card_number}` (例如: "Mew ex SV4a 347/190")。
*   **圖片讀取 (`image_url`)**: 優先讀取 Cloud Storage 絕對路徑，前端顯示強制使用 `src/lib/imageUtils.ts` 中的 `getHighResImage` 及 `handleImageError` 來呈現並處理預設降級圖。

### 2. 價格更新與歷史走勢圖 (`price_history`)
*   **嚴禁直接覆寫**: 絕對不要直接使用 `setDoc` 或 `updateDoc` 來覆寫 `pokeca_gold` 或 `new_products` 內的 `market_data.psa10_price`。
*   **必須呼叫 Service**: 更新價格**強制使用** `src/lib/priceService.ts` 內的 `updateProductPrice(productId, record, targetDbOverride)`。
*   **底層邏輯**: 此 Service 會一併更新主文檔的 `market_data` 並自動新增一筆紀錄到子集合 `{collectionName}/{id}/price_history` 內，供前端 `<PriceTrend />` 走勢圖調用。
*   **Admin SDK 相容**: 若在 Node JS 後端 (如 tg bot / leaderboardService) 呼叫，需傳入 `targetDb` 以相容 Firebase Admin SDK。

### 3. 圖片縮放與顯示規範 (Image Display Rules)
為了在不同來源的圖片間取得視覺平衡，Agent 必須遵循以下 `getImageClass` 邏輯：
*   **完整展示 (`object-contain`)**: 
    *   適用對象：Firebase Storage (`firebasestorage.app`)、高清來源 (`pokemontcg.io`, `limitless`, `pokeca-chart.com`)、手動上傳的 JP 特殊圖 (`_jp.jpg`)。
    *   效果：展示整張卡片邊框，不進行裁切。
*   **自動補償縮放 (`object-cover` + `scale`)**:
    *   適用對象：Snkrdunk 原始縮圖 (其原圖比例為圓形或正方形)。
    *   效果：套用 `scale-[1.75] md:scale-[1.85]` 並使用 `object-cover` 填滿卡片容器，模擬全圖效果。
*   **統一入口**: 所有圖片 CSS 類名必須經由 `src/lib/imageUtils.ts` 的 `getImageClass(url)` 產生。

### 4. 高清圖片與排行榜維護 (High-Res & Leaderboard)
對於特別是排行榜（Leaderboard）前列的卡片，Agent 應確保其圖片解析度達到「大圖等級」：
*   **解析度標準**: 建議解析度等級為 **733 x 1024** 或更高。
*   **來源優先權**:
    1.  **Firebase Storage**: 已手動上傳的高清圖。
    2.  **Pokeca-Chart 高清源**: 網址包含 `pokeca-chart.com/wp-content/uploads/` 的原始圖檔（通常為 733x1024）。
    3.  **Snkrdunk Fallback**: 僅在無高清源時使用 `cdn.snkrdunk.com` 的去背圖。
*   **排行榜維護**: 每次更新排行榜時，務必檢查 `leaderboard` 集合中每項的 `image_url` 是否已對應到最優質的高清圖片源，並確保 `src/lib/imageUtils.ts` 已包含該卡片的解析邏輯。

### 5. 圖片 Source 嚴格規則（2026-05-22 強制）🔴
**TL;DR**：`pokemontcg.io` 除非係 Van Gogh，否則**嚴禁使用**。

| 卡 | 來源 | 備註 |
|----|------|------|
| **SVP 085 梵高比卡超**（rank_01） | `pokemontcg.io/svp/85_hires.png` | ✅ 唯一例外 |
| 其餘所有卡 | `pokemon-card.com` / `pokeca-chart.com` / TCGPlayer | ❌ pokemontcg.io 嚴禁 |

**原因**：pokemontcg.io 係 404 高發戶，Firestore 死 URL → fallback 去 pokemontcg.io 仍然死圖。

**TCGPlayer URL 格式**：
```
https://product-images.tcgplayer.com/fit-in/437x437/{productId}.jpg
```

**已驗證的 TCGPlayer Product IDs（2026-05-22）**：
| 卡 | set_code | card_number | TCGPlayer product ID |
|----|----------|-------------|---------------------|
| Lillie SAR | SV5a | 191 | 304800 |
| 皮卡丘 ex | SV8a | 236 | **253999**（唔係 297629） |
| M Charizard ex | BW9 | 082 | 313829 |

**`handleImageError` 第 5 參數 `cardId`**：
- `imageUtils.ts` 的 `handleImageError(e, originalUrl, name, setAndNumber, cardId)` 接受 5 個參數
- Call sites 必須傳入 `cardId`（之前只傳 4 個參數，cardId 被忽略，導致 override 失效）
- 所有 call sites：`ProductDetail.tsx`、`PriceLeaderboard.tsx`

**Pokeca-chart.com 死 URL（2026-05-22 確認）**：
| Rank | 卡 | pokeca-chart.com URL | HTTP |
|------|-----|----------------------|------|
| rank_02 | 月亮伊布 VMAX | `BURAKKI-VMAX-733x1024.jpg` | **404** |
| rank_03 | 盔甲超夢 | `AMADOMYUUTSU.jpg` | **404** |
| rank_08/09/10 | — | limitlesstcg S3 | **403** |

### 6. PSA Population 數據流向（2026-05-22）
**重要**：PSA population（`psa_pop_total`、`psa_pop_10`、`psa_pop_10_percent`）係**動態數據**，唔存在於 Firestore leaderboard docs，必須從 pokeca-chart.com 即時拉取。

**數據流向**：
```
pokeca-chart.com API → CardReader.getCard() → ProductDetail.tsx useEffect enrich
                    ↘ Firestore leaderboard.market_data.psa_pop_total（只係備份）
```

**ProductDetail.tsx `useEffect` 邏輯**：
```typescript
useEffect(() => {
  if (!product?.card_id || product?.market_data?.psa_pop_total) return;
  const enrichPsa = async () => {
    const card = await CardReader.getCard(product.card_id);
    if (card?.market_data?.psa_pop_total) {
      setProduct(prev => prev ? {
        ...prev,
        market_data: { ...prev.market_data, ...card.market_data }
      } : null);
    }
  };
  enrichPsa();
}, [product?.card_id, product?.market_data?.psa_pop_total]);
```

**領導 board / MOCK_PRODUCTS 只有價格數據**（`psa10_price`、`raw_price`），沒有 PSA population。

---

## 🔧 TCG 運維必讀（整合自 tcg-operation-menu v1.13.0）

### 🔴 pokeca-chart.com API 解密（2026-05-22）
**腳本**：`/home/ubuntu/scripts/pokeca_chart_scraper.py`

| 項目 | 值 |
|------|---|
| Endpoint | `https://pokeca-chart.com/ch/api/v1/item?limit=1` |
| Passphrase | `vQpUc4ej` + `YYYY-MM-DD`（JST，每日 rotate） |
| Key derivation | PBKDF2(passphrase, SHA512, 100 iterations) |
| Cipher | AES-256-CBC |
| **一次返回全部 604 張卡**，無需 Tor/CVM 直連 |

**兩種 arrayPriceInfo 格式（必須同時支援！）**：
- 舊卡（如 ID 1）：`dict` `{"0": {...}, "1": {...}}` → `arrayPriceInfo["0"]["nDataNum"]`
- 新卡（如 ID 2）：`list` `[{}, {}, {}]` → `arrayPriceInfo[0]["nDataNum"]`

**同步狀態**：604 張卡已寫入 `pokeca_gold`，Cron Job 每 6 小時執行。

---

### 🔴 Firebase Firestore Quota 致命踩坑
**Firestore free tier 每日 50,000 reads**。以下方式會極速燒Quota：

```python
# ❌ 錯 — 每調用一次燒 50+ reads
for s in ['sv2a', 's12a', 'sv8a']:
    count = sum(1 for _ in db.collection('price_history').where('set_code', '==', s).stream())

# ✅ 啱 — 單 doc 讀取，每個 = 1 read
doc = db.collection('price_history').document('sv2a_205_ja').get()
```

**原則**：
- 配額爆掉期間**完全唔好做任何 read query**
- 背景 writes 不受影響，但會排隊等 quota 恢復
- 配額重置：UTC 00:00（約香港時間 08:00）

---

### 🔴 Vercel Deploy — CLI 成功 ≠ Deployment 成功
**必須查 GitHub Deployment API 的 `state` 欄位**，vercel CLI / Vercel Dashboard 都可能誤導：

```bash
# 查最新 deployment state
gh api repos/tiudsng/tcg-invest-v3/deployments --paginate | python3 -c "
import sys,json
for d in json.load(sys.stdin)[:2]:
    print('sha:', d['sha'][:8], 'env:', d['environment'], 'state:')
"
# 然後查 state:
gh api repos/tiudsng/tcg-invest-v3/deployments/<ID>/statuses | python3 -c "
import sys,json
for s in json.load(sys.stdin): print('state:', s['state'])
"
```

**正確流程**：
```bash
npm run build
vercel build --prod --yes --token <vcp_TOKEN>
vercel deploy --prebuilt --prod --yes --token <vcp_TOKEN>
# 然後等 60s 查 GitHub Deployment API state
```

---

### 🔴 Git Rebase Conflict — 推薦模式
```bash
# 保存本地 independent fixes 的 diff
git diff origin/main -- src/lib/imageUtils.ts src/ProductDetail.tsx > /tmp/my_fixes.patch

# reset 到 remote（乾淨狀態）
git reset --hard origin/main

# 重新應用 diff
git apply /tmp/my_fixes.patch && git add -A && git commit -m "fix: ..." && git push
```

---

### 🔴 card_id 前綴別搞混
| 格式 | 示例 | 用途 |
|------|------|------|
| URL slug | `snk**d**unk_XXXXXX`（多一個d） | URL、PriceLeaderboard card_id |
| Firestore `snkrdunk_id` field | `snk**r**dunk_XXXXXX`（正確） | `leaderboard.snkrdunk_id` |

**ProductDetail.tsx 自動轉換**：
```typescript
const firestoreId = id.replace('snkdunk_', 'snkrdunk_'); // 一個字節之差
```

---

### 🕷️ curl_cffi 指紋池（2026-05-16 實測）
**可用指紋**：chrome120, chrome110, chrome99, safari15_5, edge101, edge99 ✅
**不可用**：chrome96, safari16_0, safari14_0, firefox120/115/110/102 ❌

**CurlError code 對照**：
- code 7/28 → TIMEOUT（connect fail / timeout）
- code 35/56 → SSL_ERROR
- code 6 → DNS resolve fail（常見 `www.snkrdunk.com` vs `snkrdunk.com`）

---

### 💱 JPY→HKD 標準匯率：0.0512
**錯誤值 0.052 會造成 ~1.5% 系統性高估。**

---

### 📁 關鍵檔案位置（Cloud Run 環境）
| 檔案 | 用途 |
|------|------|
| `/AGENTS.md` | 共享行為法則（本檔案） |
| `/src/services/CardReader.ts` | 卡牌讀取服務 |
| `/src/components/PriceLeaderboard.tsx` | 排行榜組件 |
| `/src/lib/imageUtils.ts` | 圖片 URL 處理 |
| `/server.ts` | 啟動入口 |

---

### 🗑️ 腳本清理（待清理）
| 家族 | 重疊率 |
|------|--------|
| `scraper_pokeca.cjs` vs `v2_backup` | 97.3% |
| `scraper_pokeca.cjs` vs `v3_proxy` | 90.3% |

**未使用嘅工具**：`tcg_invest_utils.cjs` — 導出 utility functions 但**沒有任何 script 引用佢**。

---

### 🔧 node-cron 行為（2026-05-21 發現）
`cron.schedule('*/5 * * * *', callback)` 在 cron job 觸發後才執行 `dispatcher.pollAndDispatch()`，但 poll 週期是每 5 分鐘一次（`14:01`、`14:05`...）。如果任務提前完成，下一個要等 5 分鐘。

**緩解**：手動將任務 `kanban` 改為 `"not-started"` 可在下一個 poll 立即派發。

---

### 📸 imageUtils.ts Override 優先級
`getHighResImage(url?, name?, setAndNumber?, cardId?)` — 4 參數
`handleImageError(e, originalUrl?, name?, setAndNumber?, cardId?)` — **5 參數（v1.11.0+），有 cardId**

**Override 觸發優先級**：
1. `cardId` 完全匹配（如 `snkrdunk_93021`）
2. `idStr` set+number 匹配（如 `s6a` + `95`）
3. `name` 中文關鍵字匹配（如 `梵高`/`梵谷`）

---

### 🔴 ProductDetail URL prefix handler 矩陣
| 前綴 | 示例 | Handler 邏輯 |
|------|------|-------------|
| `snkrdunk_` | `snkrdunk_107574` | `where('snkrdunk_id','==',id)` |
| `snkdunk_` | `snkdunk_93021` | replace → `snkrdunk_` 再 query |
| `pokeca_gold_` | `pokeca_gold_91606` | `where('snkrdunk_id','==',id)` |
| `sm_p_` | `sm_p_001` | `where('card_id','==',id)` |
| `s6a_` | `s6a_001` | `where('card_id','==',id)` |
| `rank_` | `rank_02` | 直接 `doc(db,'leaderboard',id)` |

---

### 🕷️ SNKRDUNK JS-Rendered 數據（curl_cffi 盲點）
`/trading-cards/{id}/used` 頁面係 JavaScript 動態渲染，curl_cffi 直接請求返回 404 或 HTML Shell。

**可用數據**：base URL `/trading-cards/{id}` 返回 JSON-LD `{"price":112}`（最低報價，非分級）。

**完整 grade-level listing**：需要 Puppeteer/Playwright 或 Residential Proxy。

---

### ⏰ Cron Job ID 參考
| Job | Schedule | 用途 |
|-----|----------|------|
| `pokeca-chart daily sync` | 每 6 小時 | pokeca-chart.com bulk sync |
| `us-equity-strategy` | 每週六 09:00 | 美股策略 |

---

### 📊 Arch Guardian 健康度（2026-05-13）：51/100 🔴
主要問題：JPY→HKD 匯率衝突（14+ 檔案）、腳本重疊（97.3%）。

---

## 🛠️ SNKRDUNK New Card Workflow（7-Phase）

### 目標
給定 `set_code + card_number`，自動完成：探索 → 設計 → 實作 → Smoke Test → 文件化 → 發布。

### 技能位置
`~/.hermes/skills/tcg-workflow/snkdunk-new-card-workflow/`

### 輸入輸出 Contract

**Input Schema**:
```yaml
set_code: string      # 例如 "SV9", "SV8a", "SM4+"
card_number: string   # 例如 "120", "114", "119"
snkrdunk_id: string?  # 已知則跳過 Phase 1 的 ID 探測
dry_run: boolean=true # 預設 True，先驗證後寫入
```

**Output (trajectory.json)**:
```json
{
  "workflow": "snkrdunk-new-card-workflow", "version": "1.0.0",
  "run_id": "20260525-143022",
  "input": {"set_code": "SV9", "card_number": "114"},
  "phases": [
    {"phase": 1, "name": "Analyze", "status": "success", "output": {"item_id": null, "slug": "sv9-114-100"}},
    {"phase": 2, "name": "Design", "status": "success", "output": {"doc_id": "sv9_114_ja", "firestore_path": "pokeca_gold/sv9_114_ja"}},
    {"phase": 5, "name": "Smoke Test", "status": "pass", "confidence": 1.0}
  ],
  "final_status": "success", "confidence": 1.0
}
```

### Phase 詳細說明

| Phase | 名稱 | 核心邏輯 |
|-------|------|---------|
| 1 | Analyze | fetch_pokeca_items() → find_card_by_number() |
| 2 | Design | doc_id = `{slug_parts[0]}_{slug_parts[1]}_ja` |
| 3 | Implement | 生成 card_doc（dry_run 只驗證，唔寫入） |
| 4 | Plan Tests | 輸出 smoke_test_spec.yaml |
| 5 | **Smoke Test** | 4-layer assertion chain，confidence ≥ 0.75 pass |
| 6 | Document | 更新 edge_cases 到 SKILL.md |
| 7 | Publish | trajectory.json 寫入 `/home/ubuntu/.hermes/trajectories/` |

### 4-Layer Assertion Chain（Phase 5）

| # | Assertion | Pass 條件 |
|---|-----------|----------|
| 1 | `http_200` | `strSlug` 和 `strName` 非空 |
| 2 | `price_01_exists` | `nPriceRecent > 0 AND < 100,000,000`（0 = warning, not fail） |
| 3 | `psa10num_reasonable` | `nPSA10Num >= 0 AND <= 1,000,000`（0 = warning, not fail） |
| 4 | `image_url_valid` | HTTP 200, Content-Type image/*, size > 5KB |

**Confidence Score**: `passed_count / 4`，≥ 0.75 算 pass。

### 執行方式

```bash
# Dry-run（推薦首次）
python3 ~/.hermes/skills/tcg-workflow/snkdunk-new-card-workflow/scripts/smoke_test_runner.py \
  --set-code SV9 --card-number 114 --dry-run

# Live run（確認 dry-run pass 後）
python3 ~/.hermes/skills/tcg-workflow/snkdunk-new-card-workflow/scripts/smoke_test_runner.py \
  --set-code SV9 --card-number 114 --live

# 查看 trajectory
cat ~/.hermes/trajectories/snkdunk-new-card-20260525-143022.json

# 查看 test report
cat ~/.hermes/trajectories/test_report_20260525-143022.log
```

### pokeca-chart.com API key facts

- **Endpoint**: `https://pokeca-chart.com/ch/api/v1/item?limit=1`（加密）
- **Passphrase**: `vQpUc4ej` + `YYYY-MM-DD`（JST）
- **解密**: PBKDF2(SHA512, 100it) → AES-256-CBC
- **返回**: dict `{card_id: card_data}`，共 735 張卡
- **arrayPriceInfo**: 舊卡是 `dict`，新卡是 `list`

### nGrdSetId → set_code mapping（動態發現）

```
nGrdSetId=123 → SV9（sv9-XXX-XXX）
nGrdSetId=17 → SM4+（sm4plus-XXX-XXX）
nGrdSetId=59 → s9（s9-XXX-XXX）
```

**slug 格式**: `{setcode}-{cardnum}-{rarity}`，例如 `sv9-114-100`。

### 關鍵設計原則

1. **dry_run: true 預設** — 避免髒數據入庫
2. **Fail-fast on Phase 1** — item not found 直接停止
3. **Confidence ≥ 0.75** — 4 assertions 中起碼 3 個 pass
4. **Warning != Fail** — 剛發售卡 PSA=0 或 price=0 算 warning 但 phase pass
5. **Trajectory 即時寫入** — crash recovery 可從 last phase 繼續
