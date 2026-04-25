# TCG Invest Manager - Agent 操作手冊

## 🤖 Telegram Bot 功能與指令
本專案整合了 Telegraf 機器人，支援以下特殊指令，Agent 在維護時應確保這些邏輯不被破壞。

### 1. 排行榜管理
*   **`/updateleaderboard`**: 觸發 `src/lib/leaderboardService.ts` 中的 `syncLeaderboard` 函數。
    *   **邏輯**：抓取 `config/leaderboard` 的設定 -> 讀取 `products` 集合的大圖 -> 呼叫 Gemini AI 分析市場 -> 更新 `list_1` 集合。
*   **`/setranks <ID1> <ID2>...`**: 動態設定排行榜順序。
    *   **參數**：需傳入以 `snkrdunk_` 開頭的 ID。
    *   **儲存位置**：Firestore `config/leaderboard` 文檔中的 `rankings` 陣列。

### 2. 文章與 AI 管理
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
2. **圖片優先權**：排行榜圖片優先讀取 `products` 集合，其次才是 `baselineData` 的 fallback URL。

## 📥 爬蟲與資料庫寫入規範 (CRITICAL)
AGENT 每次爬取或更新價格資料時，**必須**遵守以下規則，避免遺忘或破壞架構：

### 1. Products 卡片格式統一規範
寫入 `products` 集合的卡片資訊必須維持乾淨結構：
*   **`name`**: 卡片乾淨名稱，不含稀有度後綴 (例如: "Mew ex", 不要有 SAR/SR)。
*   **`set_name`**: 乾淨的系列名稱 (例如: "Shiny Treasure ex")。
*   **`set_code`**: 系列代號 (例如: "SV4a")。
*   **`card_number`**: 精準卡號 (例如: "347/190")。
*   **`display` / `name_zh`**: 統一顯示字串，格式強制為 `${name} ${set_code} ${card_number}` (例如: "Mew ex SV4a 347/190")。
*   **圖片讀取 (`image_url`)**: 優先讀取 Cloud Storage 絕對路徑，前端顯示強制使用 `src/lib/imageUtils.ts` 中的 `getHighResImage` 及 `handleImageError` 來呈現並處理預設降級圖。

### 2. 價格更新與歷史走勢圖 (`price_history`)
*   **嚴禁直接覆寫**: 絕對不要直接使用 `setDoc` 或 `updateDoc` 來覆寫 `products` 內的 `market_data.psa10_price`。
*   **必須呼叫 Service**: 更新價格**強制使用** `src/lib/priceService.ts` 內的 `updateProductPrice(productId, record, targetDbOverride)`。
*   **底層邏輯**: 此 Service 會一併更新主文檔的 `market_data` 並自動新增一筆紀錄到子集合 `products/{id}/price_history` 內，供前端 `<PriceTrend />` 走勢圖調用。
*   **Admin SDK 相容**: 若在 Node JS 後端 (如 tg bot / leaderboardService) 呼叫，需傳入 `targetDb` 以相容 Firebase Admin SDK。
