/**
 * idResolverService.ts — 日版卡片 ID 自動解析
 * 
 * 功能：
 * 1. 將內部 set_code + card_number 映射到 SNKRDUNK URL ID
 * 2. 寫入 Firestore external_ids.snkrdunk
 * 3. 支援批量解析（用於新系列首次建立映射表）
 * 
 * 來源: 參考 snkrdunkSearchService.ts 的搜尋邏輯
 */

import puppeteer, { Browser, Page } from 'puppeteer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExternalIdMap {
  snkrdunk?: string;      // e.g. "pokemon-japanese-sky-legend-mewtwo-mew-gx-097-094"
  pricecharting?: string;
  cardotaku?: string;
}

export interface ResolutionResult {
  internalId: string;       // e.g. "sm11_097"
  found: boolean;
  snkrdunkId?: string;
  snkrdunkUrl?: string;
  error?: string;
}

// ─── UA Pool ──────────────────────────────────────────────────────────────────

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function randomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// ─── Core: Resolve Single Card via SNKRDUNK Search ───────────────────────────

/**
 * 將 set_code + card_number 翻譯成 SNKRDUNK URL ID
 * 
 * @param setCode   e.g. "sm11", "sm12a"
 * @param cardNum   e.g. "097", "230"
 * @returns ResolutionResult
 */
export async function resolveSnkrdunkId(
  setCode: string,
  cardNum: string
): Promise<ResolutionResult> {
  const internalId = `${setCode.toLowerCase()}_${cardNum.replace(/\/.*/, '')}`;

  // 構造搜尋關鍵詞（SNKRDUNK 接受的格式）
  // 格式: "SM11 097" 或 "sm11 097" → SNKRDUNK 搜尋
  const searchKeyword = `${setCode.toUpperCase()} ${cardNum.replace(/\/.*/, '')}`;
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(searchKeyword)}`;

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(randomUA());
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60_000 });

    // 等待搜尋結果渲染
    await new Promise(r => setTimeout(r, 5000));

    // 從搜尋結果中找第一個與目標卡號匹配的連結
    const result = await page.evaluate((targetCardNum: string) => {
      // 找所有商品連結
      const items = Array.from(document.querySelectorAll('a[href*="/trading-cards/"]'));
      
      for (const item of items) {
        const href = (item as HTMLAnchorElement).href;
        const text = item.innerText || '';
        
        // 跳過 used/browse 之類的非商品連結
        if (!href || href.includes('/used') || href.includes('/browse')) continue;

        // 從 URL 提取 ID
        const match = href.match(/\/trading-cards\/([^/?]+)/);
        if (!match) continue;
        
        const cardId = match[1];
        
        // 嘗試從卡名或 URL 中找到目標卡號
        // 目標: 找到包含 "097" 或 "97" 的卡
        const cardNumClean = targetCardNum.replace(/^0+/, ''); // 去掉前導0
        
        if (text.includes(targetCardNum) || text.includes(cardNumClean)) {
          return {
            snkrdunkId: cardId,
            snkrdunkUrl: href,
          };
        }

        // 也檢查 URL 中是否含卡號
        if (cardId.includes(targetCardNum) || cardId.includes(cardNumClean)) {
          return {
            snkrdunkId: cardId,
            snkrdunkUrl: href,
          };
        }
      }
      return null;
    }, cardNum.replace(/\/.*/, ''));

    if (result) {
      return {
        internalId,
        found: true,
        snkrdunkId: result.snkrdunkId,
        snkrdunkUrl: result.snkrdunkUrl,
      };
    }

    return {
      internalId,
      found: false,
      error: 'No matching card found in SNKRDUNK search results',
    };

  } catch (err: any) {
    return {
      internalId,
      found: false,
      error: err.message,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Batch Resolution ─────────────────────────────────────────────────────────

/**
 * 批量解析一組 set_code + card_number
 * 每次解析之間有隨機延遲，防止被識別為機器人
 */
export async function batchResolveId(
  entries: Array<{ setCode: string; cardNum: string; firestoreDocId: string }>,
  onProgress?: (result: ResolutionResult) => void
): Promise<ResolutionResult[]> {
  const results: ResolutionResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { setCode, cardNum, firestoreDocId } = entries[i];

    console.log(`[IDResolver] Resolving ${setCode} ${cardNum} (${i + 1}/${entries.length})...`);
    
    const result = await resolveSnkrdunkId(setCode, cardNum);

    if (onProgress) {
      onProgress(result);
    }

    results.push(result);

    // 隨機延遲 1.5-4 秒（模擬人類操作）
    if (i < entries.length - 1) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 2500));
    }
  }

  return results;
}

// ─── Firestore Update Helper ──────────────────────────────────────────────────

export async function updateExternalIdsInFirestore(
  results: ResolutionResult[],
  db: any,
  collectionName: string = 'products'
): Promise<{ updated: number; failed: number }> {
  const { doc, updateDoc } = await import('firebase/firestore');
  
  let updated = 0;
  let failed = 0;

  for (const result of results) {
    if (!result.found || !result.snkrdunkId) {
      failed++;
      continue;
    }

    try {
      const docId = result.internalId.includes('_') 
        ? result.internalId 
        : `${result.internalId}`;
      const docRef = doc(db, collectionName, docId);

      await updateDoc(docRef, {
        'external_ids.snkrdunk': result.snkrdunkId,
        'external_ids.lastResolved': new Date().toISOString(),
      });

      console.log(`[IDResolver] Updated ${docId} → ${result.snkrdunkId}`);
      updated++;
    } catch (err: any) {
      console.warn(`[IDResolver] Failed to update ${result.internalId}: ${err.message}`);
      failed++;
    }
  }

  return { updated, failed };
}

// ─── Convenience: Resolve and Scrape in One Go ────────────────────────────────

/**
 * 给定 internal ID (e.g. "sm11_097")，自動解析 SNKRDUNK ID，再抓價格
 * 這是 Phase 2 的核心入口方法
 */
export async function resolveAndScrape(
  setCode: string,
  cardNum: string,
  snkrdunkBatchService: any  // 注入 batch service
): Promise<{
  internalId: string;
  snkrdunkId: string;
  stats: any;
  wroteToFirestore: boolean;
}> {
  // Step 1: Resolve ID
  const resolution = await resolveSnkrdunkId(setCode, cardNum);
  
  if (!resolution.found || !resolution.snkrdunkId) {
    throw new Error(`Cannot resolve SNKRDUNK ID for ${setCode}_${cardNum}: ${resolution.error}`);
  }

  // Step 2: Scrape via batch service (using resolved ID)
  const cardId = resolution.snkrdunkId;
  const syncResult = await snkrdunkBatchService.syncMarketDataForCard(cardId, true);

  return {
    internalId: resolution.internalId,
    snkrdunkId: cardId,
    stats: syncResult.stats,
    wroteToFirestore: syncResult.wroteToFirestore,
  };
}