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
2. **圖片優先權**：排行榜圖片優先讀取 `pokeca_gold` 集合，其次才是 `baselineData` 的 fallback URL。

## 📥 爬蟲與資料庫寫入規範 (CRITICAL)
AGENT 每次爬取或更新價格資料時，**必須**遵守以下規則，避免遺忘或破壞架構：

### 1. Pokeca Gold 卡片格式統一規範
寫入 `pokeca_gold` 集合的卡片資訊必須維持乾淨結構：
*   **`name`**: 卡片乾淨名稱，不含稀有度後綴 (例如: "Mew ex", 不要有 SAR/SR)。
*   **`set_name`**: 乾淨的系列名稱 (例如: "Shiny Treasure ex")。
*   **`set_code`**: 系列代號 (例如: "SV4a")。
*   **`card_number`**: 精準卡號 (例如: "347/190")。
*   **`display` / `name_zh`**: 統一顯示字串，格式強制為 `${name} ${set_code} ${card_number}` (例如: "Mew ex SV4a 347/190")。
*   **Doc ID 格式**: 目前使用 `set_code` 格式 (例如: "sm11a-068-064")，未來計劃迁移至 SNKRDUNK ID。
*   **圖片讀取 (`image_url`)**: 優先讀取 Cloud Storage 絕對路徑，前端顯示強制使用 `src/lib/imageUtils.ts` 中的 `getHighResImage` 及 `handleImageError` 來呈現並處理預設降級圖。

### 2. New Products（新卡觀察名單）
`new_products` 集合用於追蹤尚未完全整合進主庫的新卡：
*   **Doc ID**: 使用 `snkrdunk_{id}` 格式。
*   **待 Migration**: `card_id` 欄位需待迁移至 `pokeca_gold` 時更新。
*   **價格更新**: 一旦卡已穩定，應將 market_data 遷移至 `pokeca_gold` 並刪除 `new_products` 中的文檔。

### 3. 價格更新與歷史走勢圖 (`price_history`)
*   **嚴禁直接覆寫**: 絕對不要直接使用 `setDoc` 或 `updateDoc` 來覆寫 `pokeca_gold` 內的 `market_data.psa10_price`。
*   **必須呼叫 Service**: 更新價格**強制使用** `src/lib/priceService.ts` 內的 `updateProductPrice(productId, record, targetDbOverride)`。
*   **底層邏輯**: 此 Service 會一併更新主文檔的 `market_data` 並自動新增一筆紀錄到子集合 `pokeca_gold/{id}/price_history` 內，供前端 `<PriceTrend />` 走勢圖調用。
*   **Admin SDK 相容**: 若在 Node JS 後端 (如 tg bot / leaderboardService) 呼叫，需傳入 `targetDb` 以相容 Firebase Admin SDK。

### 4. 圖片縮放與顯示規範 (Image Display Rules)
為了在不同來源的圖片間取得視覺平衡，Agent 必須遵循以下 `getImageClass` 邏輯：
*   **完整展示 (`object-contain`)**: 
    *   適用對象：Firebase Storage (`firebasestorage.app`)、高清來源 (`pokemontcg.io`, `limitless`, `pokeca-chart.com`)、手動上傳的 JP 特殊圖 (`_jp.jpg`)。
    *   效果：展示整張卡片邊框，不進行裁切。
*   **自動補償縮放 (`object-cover` + `scale`)**:
    *   適用對象：Snkrdunk 原始縮圖 (其原圖比例為圓形或正方形)。
    *   效果：套用 `scale-[1.75] md:scale-[1.85]` 並使用 `object-cover` 填滿卡片容器，模擬全圖效果。
*   **統一入口**: 所有圖片 CSS 類名必須經由 `src/lib/imageUtils.ts` 的 `getImageClass(url)` 產生。

### 5. 高清圖片與排行榜維護 (High-Res & Leaderboard)
對於特別是排行榜（Leaderboard）前列的卡片，Agent 應確保其圖片解析度達到「大圖等級」：
*   **解析度標準**: 建議解析度等級為 **733 x 1024** 或更高。
*   **來源優先權**: 
    1.  **Firebase Storage**: 已手動上傳的高清圖。
    2.  **Pokeca-Chart 高清源**: 網址包含 `pokeca-chart.com/wp-content/uploads/` 的原始圖檔（通常為 733x1024）。
    3.  **Snkrdunk Fallback**: 僅在無高清源時使用 `cdn.snkrdunk.com` 的去背圖。
*   **排行榜維護**: 每次更新排行榜時，務必檢查 `leaderboard` 集合中每項的 `image_url` 是否已對應到最優質的高清圖片源，並確保 `src/lib/imageUtils.ts` 已包含該卡片的解析邏輯。

## 🔑 Firebase Storage 關鍵發現（2026.05.06）

### Bucket 名稱
- **錯誤：** `gen-lang-client-0326385388.appspot.com`（Cloud Run 用）
- **正確：** `gen-lang-client-0326385388.firebasestorage.app`
- 所有 Storage API calls 必須用 `.firebasestorage.app`

### Storage API Endpoints
- **List files：** 用 GCS endpoint，唔係 Firebase Storage endpoint
  - `GET https://storage.googleapis.com/storage/v1/b/{bucket}/o?maxResults=200`
  - 需要 OAuth token（`cloud-platform` scope）
- **Upload：** Firebase Storage endpoint + `?uploadType=media&name={filename}`
  - `POST https://firebasestorage.googleapis.com/v0/b/{bucket}/o?uploadType=media&name={encoded_filename}`
  - **必須用 `cloud-platform` scope**（`devstorage.read_write` 唔夠，會 403）
  - `Content-Type` header 必須設置正確（`image/webp` 等）

### OAuth Token 取得方式（Python）
```python
from google.oauth2 import service_account
from google.auth.transport import requests as google_requests

credentials = service_account.Credentials.from_service_account_info(
    creds_dict,
    scopes=['https://www.googleapis.com/auth/cloud-platform']  # 唔係 devstorage.read_write
)
request = google_requests.Request()
credentials.refresh(request)
token = credentials.token  # 用呢個 token
```

### 撈圖片時
1. 先 list storage files（GCS endpoint）搜尋相關關鍵字
2. Storage 入面有 `card_images/`、`article_images/`、`mewtwo_jp/` 等 folder
3. Doc ID 格式：`snkrdunk_{snkrdunk_id}`（例如 `snkrdunk_107574.webp`）
4. Download URL：`https://storage.googleapis.com/{bucket}/{encoded_filename}?alt=media`
