/**
 * idMappingService.ts — 日版卡片 ID 自動映射 + 回填
 * 
 * 功能：
 * 1. 檢查 Firestore 是否已有 external_ids.snkrdunk
 * 2. 若無，啟動 fuzzy 搜尋（多種關鍵詞組合）
 * 3. 回填 mapping 到 products collection
 * 4. 建立 snkrdunk_{resolved_id} alias 文檔（可選）
 * 
 * 關鍵字策略（SM12A 230 修復）：
 *   Primary: "SM12A 230"
 *   Fallback 1: "SM12A 230/173" (加入 Set 總數)
 *   Fallback 2: "Tag All Stars 230"
 *   Fallback 3: "SM12A UR" (稀有度關鍵字)
 */

import puppeteer, { Browser } from 'puppeteer';
import { doc, writeBatch, collection, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExternalIdMap {
  snkrdunk?: string;
  snkrdunk_url?: string;
  pricecharting?: string;
  cardotaku?: string;
  lastResolved?: string;   // ISO timestamp
}

export interface MappingResult {
  internalId: string;
  docId: string;
  found: boolean;
  snkrdunkId?: string;
  snkrdunkUrl?: string;
  strategy?: string;       // Which keyword strategy succeeded
  error?: string;
}

export interface BatchMappingOptions {
  forceRefresh: boolean;   // 即使已有 mapping 也重新解析
  dryRun: boolean;         // 不寫入 Firestore，僅模擬
  onProgress?: (result: MappingResult) => void;
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

// ─── Keyword Strategy Generator ───────────────────────────────────────────────

interface KeywordStrategy {
  label: string;
  keyword: string;
}

/**
 * 為一張卡生成多個搜尋關鍵字策略（按優先順序排列）
 */
function generateKeywordStrategies(
  setCode: string,
  cardNum: string,
  options?: { rarity?: string; japaneseSetName?: string; setTotal?: number }
): KeywordStrategy[] {
  const strategies: KeywordStrategy[] = [];
  const cleanNum = cardNum.replace(/\/.*/, '').replace(/^0+/, '') || cardNum;
  const setUpper = setCode.toUpperCase().replace(/-/g, '').replace(/_/g, '');
  const setLower = setCode.toLowerCase();

  // Primary: "SM12A 230"
  strategies.push({
    label: 'primary',
    keyword: `${setUpper} ${cleanNum}`,
  });

  // Fallback 1: "SM12A 230/173" (with set total)
  if (options?.setTotal) {
    strategies.push({
      label: 'with_total',
      keyword: `${setUpper} ${cleanNum}/${options.setTotal}`,
    });
  }

  // Fallback 2: "Tag All Stars 230"
  if (options?.japaneseSetName) {
    strategies.push({
      label: 'jp_set_name',
      keyword: `${options.japaneseSetName} ${cleanNum}`,
    });
  }

  // Fallback 3: "SM12A UR" (rarity-based)
  if (options?.rarity) {
    strategies.push({
      label: 'with_rarity',
      keyword: `${setUpper} ${options.rarity}`,
    });
  }

  // Fallback 4: "SM12A 230 UR"
  if (options?.rarity) {
    strategies.push({
      label: 'num_plus_rarity',
      keyword: `${setUpper} ${cleanNum} ${options.rarity}`,
    });
  }

  // Fallback 5: Just the card number alone (fuzzy)
  strategies.push({
    label: 'card_num_only',
    keyword: cleanNum,
  });

  return strategies;
}

// ─── Core: Fuzzy Search Single Card ──────────────────────────────────────────

/**
 * 嘗試所有關鍵字策略直到找到匹配
 */
async function fuzzyResolveSnkrdunkId(
  setCode: string,
  cardNum: string,
  options?: { rarity?: string; japaneseSetName?: string; setTotal?: number }
): Promise<{ snkrdunkId: string; snkrdunkUrl: string; strategy: string } | null> {
  const strategies = generateKeywordStrategies(setCode, cardNum, options);

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    for (const strategy of strategies) {
      console.log(`  [FuzzySearch] Trying: "${strategy.keyword}" (${strategy.label})`);

      const result = await trySearchStrategy(browser, strategy.keyword, cardNum);
      
      if (result) {
        return { ...result, strategy: strategy.label };
      }

      // 策略間隨機延遲（1-2秒）
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    }

    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function trySearchStrategy(
  browser: Browser,
  keyword: string,
  targetCardNum: string
): Promise<{ snkrdunkId: string; snkrdunkUrl: string } | null> {
  const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(keyword)}`;

  const page = await browser.newPage();
  await page.setUserAgent(randomUA());
  await page.setViewport({ width: 1280, height: 800 });

  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
    await new Promise(r => setTimeout(r, 4000)); // 等待渲染

    const result = await page.evaluate((targetNum: string) => {
      const items = Array.from(document.querySelectorAll('a[href*="/trading-cards/"]'));
      
      for (const item of items) {
        const href = (item as HTMLAnchorElement).href;
        const text = (item as HTMLElement).innerText || '';
        
        if (!href || href.includes('/used') || href.includes('/browse') || href.includes('/category')) continue;

        const match = href.match(/\/trading-cards\/([^/?]+)/);
        if (!match) continue;
        
        const cardId = match[1];
        const numClean = targetNum.replace(/^0+/, '');

        // 檢查卡片號碼是否匹配
        const numMatch = text.includes(targetNum) || text.includes(numClean) ||
                         cardId.includes(targetNum) || cardId.includes(numClean);

        // 檢查 URL 是否合理（不應該是超長的隨機字串）
        const urlReasonable = cardId.length < 100 && !cardId.includes(' ');

        if (numMatch && urlReasonable) {
          return { snkrdunkId: cardId, snkrdunkUrl: href };
        }
      }
      return null;
    }, targetCardNum.replace(/\/.*/, ''));

    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

// ─── Firestore: Check Existing Mapping ────────────────────────────────────────

/**
 * 檢查 Firestore 是否已有 snkrdunk external ID
 */
export async function getExistingMapping(
  internalId: string,
  collectionName: string = 'products'
): Promise<string | null> {
  try {
    const docRef = doc(db, collectionName, internalId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) return null;
    
    return snapshot.data().external_ids?.snkrdunk ?? null;
  } catch (err) {
    console.warn(`[IDMapper] Failed to read existing mapping for ${internalId}:`, err);
    return null;
  }
}

// ─── Firestore: Write Mapping ─────────────────────────────────────────────────

/**
 * 將 resolved ID 回填到 Firestore
 * Uses setDoc with merge so it works for both existing and new docs
 */
async function writeMappingToFirestore(
  internalId: string,
  snkrdunkId: string,
  snkrdunkUrl: string,
  collectionName: string = 'products'
): Promise<void> {
  const { setDoc } = await import('firebase/firestore');
  const docRef = doc(db, collectionName, internalId);
  
  // Use setDoc with merge — works whether doc exists or not
  await setDoc(docRef, {
    external_ids: {
      snkrdunk: snkrdunkId,
      snkrdunk_url: snkrdunkUrl,
      lastResolved: new Date().toISOString(),
    },
    // Also create a lightweight stub if doc doesn't exist yet
    internal_id: internalId,
    updatedBy: 'idMapper',
  }, { merge: true });

  console.log(`[IDMapper] ✅ ${internalId} → ${snkrdunkId}`);
}

// ─── Main: Resolve and Store (One Card) ──────────────────────────────────────

/**
 * 解析並儲存單張卡的映射關係
 */
export async function resolveAndStoreMapping(
  internalId: string,         // e.g. "sm12a_230"
  options?: {
    setCode?: string;
    cardNum?: string;
    rarity?: string;
    japaneseSetName?: string;
    setTotal?: number;
    forceRefresh?: boolean;
    dryRun?: boolean;
  }
): Promise<MappingResult> {
  const { setCode, cardNum, forceRefresh = false, dryRun = false } = options || {};

  // ── Step 1: Check existing mapping ─────────────────────────────────────────
  if (!forceRefresh) {
    const existing = await getExistingMapping(internalId);
    if (existing) {
      console.log(`[IDMapper] ℹ️  ${internalId} already has snkrdunk ID: ${existing}`);
      return {
        internalId,
        docId: internalId,
        found: true,
        snkrdunkId: existing,
        strategy: 'cached',
      };
    }
  }

  // ── Step 2: Fuzzy resolve ──────────────────────────────────────────────────
  if (!setCode || !cardNum) {
    return {
      internalId,
      docId: internalId,
      found: false,
      error: 'setCode and cardNum required for resolution',
    };
  }

  const resolved = await fuzzyResolveSnkrdunkId(setCode, cardNum, {
    rarity: options?.rarity,
    japaneseSetName: options?.japaneseSetName,
    setTotal: options?.setTotal,
  });

  if (!resolved) {
    return {
      internalId,
      docId: internalId,
      found: false,
      error: `All keyword strategies exhausted — card not found on SNKRDUNK`,
    };
  }

  // ── Step 3: Write to Firestore (unless dry-run) ────────────────────────────
  if (!dryRun) {
    await writeMappingToFirestore(internalId, resolved.snkrdunkId, resolved.snkrdunkUrl);
  } else {
    console.log(`[IDMapper] 🔍 [DRY RUN] Would write: ${internalId} → ${resolved.snkrdunkId}`);
  }

  return {
    internalId,
    docId: internalId,
    found: true,
    snkrdunkId: resolved.snkrdunkId,
    snkrdunkUrl: resolved.snkrdunkUrl,
    strategy: resolved.strategy,
  };
}

// ─── Batch: Resolve and Store Multiple Cards ──────────────────────────────────

/**
 * 批量解析並回填多張卡
 */
export async function batchResolveAndStore(
  entries: Array<{
    internalId: string;
    setCode: string;
    cardNum: string;
    rarity?: string;
    japaneseSetName?: string;
    setTotal?: number;
  }>,
  options?: Partial<BatchMappingOptions>
): Promise<{ success: number; failed: number; results: MappingResult[] }> {
  const { forceRefresh = false, dryRun = false, onProgress } = options || {};
  
  const results: MappingResult[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    console.log(`\n[IDMapper] Processing ${i + 1}/${entries.length}: ${entry.internalId}`);
    
    const result = await resolveAndStoreMapping(entry.internalId, {
      setCode: entry.setCode,
      cardNum: entry.cardNum,
      rarity: entry.rarity,
      japaneseSetName: entry.japaneseSetName,
      setTotal: entry.setTotal,
      forceRefresh,
      dryRun,
    });

    if (onProgress) onProgress(result);
    results.push(result);

    // 隨機延遲（防止被識別為機器人）
    if (i < entries.length - 1) {
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }
  }

  const success = results.filter(r => r.found).length;
  const failed = results.filter(r => !r.found).length;

  console.log(`\n[IDMapper] Batch complete: ✅ ${success} / ❌ ${failed}`);

  return { success, failed, results };
}

// ─── Utility: Parse internal ID ───────────────────────────────────────────────

/**
 * 從 internal ID 解析 set_code 和 card_num
 * e.g. "sm12a_230" → { setCode: "sm12a", cardNum: "230" }
 */
export function parseInternalId(internalId: string): { setCode: string; cardNum: string } | null {
  // Handle formats: sm12a_230, sm11_097, S12A_230
  const match = internalId.match(/^([a-zA-Z0-9_-]+)[_ ](\d+.*)$/);
  if (!match) return null;
  
  return {
    setCode: match[1].replace(/-/g, '').replace(/_/g, '').toLowerCase(),
    cardNum: match[2],
  };
}