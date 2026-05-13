/**
 * snkrdunkBatchService.ts — 批次價格爬蟲 + Stale-While-Revalidate
 * 
 * 設計目標:
 * 1. 一個 Browser 實例 + 多個 Incognito Tab（每張卡獨立 Tab）
 * 2. TTL Cache (5min) + Stale-While-Revalidate (5-10min)
 * 3. Per-tab 隨機 UA + Viewport 防止機器人偵測
 * 4. 單卡失敗不影響整批（fail-gracefully）
 * 
 * 來源: 改編自 src/lib/snkrdunkSearchService.ts
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { doc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { PriceRecord } from './priceService';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SnkrdunkMarketStats {
  median_sold_psa10: number | null;
  median_listed_psa10: number | null;
  median_sold_raw: number | null;
  currency: string;
  sold_psa10_count: number;
  listed_psa10_count: number;
  method: string;
  error?: string;
  scrapedAt: string;   // ISO timestamp
}

export interface BatchScrapeResult {
  success: boolean;
  data: Map<string, SnkrdunkMarketStats>;
  failedIds: string[];
  cachedIds: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1000;   // 5 分鐘 → 視為 stale
const MAX_STALE_MS       = 10 * 60 * 1000;  // 10 分鐘 → 強迫刷新
const BATCH_SIZE         = 5;               // 每批處理 N 張卡
const INTER_BATCH_DELAY  = 2000;            // 批次間 2 秒延遲

// ─── Per-Tab UA Pool ──────────────────────────────────────────────────────────

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const VIEWPORT_POOL = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

function randomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

function randomViewport() {
  return VIEWPORT_POOL[Math.floor(Math.random() * VIEWPORT_POOL.length)];
}

// ─── In-Memory TTL Cache ──────────────────────────────────────────────────────
// 簡單 Map-based TTL cache（生產環境建議換成 node-cache 或 Redis）

interface CacheEntry {
  data: SnkrdunkMarketStats;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

export function getCachedStats(cardId: string): SnkrdunkMarketStats | null {
  const entry = memoryCache.get(cardId);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > MAX_STALE_MS) {
    memoryCache.delete(cardId); // 強迫刷新
    return null;
  }
  return entry.data;
}

export function setCachedStats(cardId: string, data: SnkrdunkMarketStats): void {
  memoryCache.set(cardId, {
    data,
    timestamp: Date.now(),
  });
}

export function isFresh(cardId: string): boolean {
  const entry = memoryCache.get(cardId);
  if (!entry) return false;
  return (Date.now() - entry.timestamp) <= STALE_THRESHOLD_MS;
}

export function getCacheAge(cardId: string): number | null {
  const entry = memoryCache.get(cardId);
  if (!entry) return null;
  return Date.now() - entry.timestamp;
}

// ─── Core: Scrape Single Card ─────────────────────────────────────────────────

async function scrapeSingleCard(page: Page, snkrId: string): Promise<SnkrdunkMarketStats> {
  const targetUrl = `https://snkrdunk.com/en/trading-cards/${snkrId}/used`;

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });

  // 隨機延遲（模擬人類）
  await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

  // 點擊 PSA 10 filter
  try {
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      for (const el of labels) {
        if (el.innerText.includes('PSA 10') || el.innerText.includes('PSA10')) {
          const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
          if (radio) { radio.click(); break; }
        }
      }
    });
    await new Promise(r => setTimeout(r, 2000)); // 等過濾結果
  } catch (_) {
    // filter 可能不存在，硬闖
  }

  // 解析報價
  const listings = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a[href*="/en/trading-cards/used/listings/"]'));
    const results: { price: number; currency: string; grade: string; isSold: boolean }[] = [];

    items.forEach(item => {
      const text = (item as HTMLElement).innerText;
      const priceMatch = text.match(/(SG\s*\$|US\s*\$|¥)\s*([\d,]+)/);
      const gradeMatch = text.match(/(SOLD\s*)?PSA\s*(\d+)/i);

      if (priceMatch) {
        results.push({
          price: parseInt(priceMatch[2].replace(/,/g, ''), 10),
          currency: priceMatch[1],
          grade: gradeMatch ? gradeMatch[2] : 'Raw',
          isSold: gradeMatch ? !!gradeMatch[1] : text.toUpperCase().includes('SOLD'),
        });
      }
    });
    return results;
  });

  const soldPsa10   = listings.filter(l => l.grade === '10' && l.isSold).map(l => l.price).sort((a, b) => a - b);
  const listedPsa10 = listings.filter(l => l.grade === '10' && !l.isSold).map(l => l.price).sort((a, b) => a - b);
  const soldRaw      = listings.filter(l => l.grade === 'Raw' && l.isSold).map(l => l.price).sort((a, b) => a - b);

  const getMedian = (arr: number[]) => {
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
  };

  return {
    median_sold_psa10: getMedian(soldPsa10),
    median_listed_psa10: getMedian(listedPsa10),
    median_sold_raw: getMedian(soldRaw),
    currency: listings[0]?.currency ?? 'US $',
    sold_psa10_count: soldPsa10.length,
    listed_psa10_count: listedPsa10.length,
    method: 'batch_psa10_filter',
    scrapedAt: new Date().toISOString(),
  };
}

// ─── Core: One Browser + Incognito Tabs ───────────────────────────────────────

async function withBrowserContext<T>(
  fn: (browser: Browser) => Promise<T>
): Promise<T> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
      ],
    });
    return await fn(browser);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ─── Core: Batch Scrape with Stale-While-Revalidate ───────────────────────────

/**
 * 批次抓取多張卡（共享一個 Browser 實例）
 * 
 * @param cardIds       array of raw snkrdunk IDs (不含 snkrdunk_ 前綴)
 * @param forceRefresh  true = 無視 cache，強制重新爬（適合管理員主動刷新）
 */
export async function batchScrapeMarketStats(
  cardIds: string[],
  forceRefresh = false
): Promise<BatchScrapeResult> {
  const data    = new Map<string, SnkrdunkMarketStats>();
  const failedIds: string[]  = [];
  const cachedIds: string[]   = [];

  // ── 分流：Cache Hit / 需要爬 ──────────────────────────────────────────────
  const toScrape: string[] = [];

  for (const rawId of cardIds) {
    if (!forceRefresh) {
      const cached = getCachedStats(rawId);
      if (cached && isFresh(rawId)) {
        data.set(rawId, cached);
        cachedIds.push(rawId);
        continue;
      }
    }
    toScrape.push(rawId);
  }

  if (toScrape.length === 0) {
    return { success: true, data, failedIds, cachedIds };
  }

  // ── 分批處理（每批 BATCH_SIZE 張卡）───────────────────────────────────────
  for (let i = 0; i < toScrape.length; i += BATCH_SIZE) {
    const batch = toScrape.slice(i, i + BATCH_SIZE);

    await withBrowserContext(async (browser) => {
      // 為每張卡建立獨立 Incognito Tab
      const tabs = await Promise.all(
        batch.map(async (rawId) => {
          const ctx = await browser.createBrowserContext();
          const page = await ctx.newPage();
          await page.setUserAgent(randomUA());
          await page.setViewport(randomViewport());
          return { rawId, page, ctx };
        })
      );

      // 並行抓取（每張卡獨立 Tab）
      const results = await Promise.allSettled(
        tabs.map(async ({ rawId, page, ctx }) => {
          try {
            const stats = await scrapeSingleCard(page, rawId);
            return { rawId, stats, error: null };
          } catch (err: any) {
            return { rawId, stats: null, error: err.message };
          } finally {
            await page.close().catch(() => {});
            await ctx.close().catch(() => {});
          }
        })
      );

      // 處理結果（單卡失敗不影響同批其他卡）
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { rawId, stats, error } = result.value;
          if (stats) {
            data.set(rawId, stats);
            setCachedStats(rawId, stats);
          } else {
            failedIds.push(rawId);
          }
        } else {
          // unexpected rejection
          const rawId = batch[results.indexOf(result)];
          if (rawId) failedIds.push(rawId);
        }
      }
    });

    // 批次間延遲
    if (i + BATCH_SIZE < toScrape.length) {
      await new Promise(r => setTimeout(r, INTER_BATCH_DELAY));
    }
  }

  const success = failedIds.length === 0;
  return { success, data, failedIds, cachedIds };
}

// ─── Stale-While-Revalidate Wrapper ────────────────────────────────────────────

/**
 * 取得卡片市況數據。
 * 策略：
 *  - Fresh (< 5min)  → 直接返回 cache
 *  - Stale (5-10min) → 立即返回舊數據，同時後台異步刷新
 *  - Very stale (> 10min) → 阻塞等待重新抓取
 * 
 * 回傳格式: { stats, isStale, isFresh }
 */
export async function getMarketStatsWithSWR(
  cardId: string,
  forceRefresh = false
): Promise<{
  stats: SnkrdunkMarketStats | null;
  isStale: boolean;
  isFresh: boolean;
}> {
  const cached = getCachedStats(cardId);

  if (!forceRefresh && cached) {
    const age = getCacheAge(cardId);
    if (age !== null && age <= STALE_THRESHOLD_MS) {
      // Fresh → 直接返回
      return { stats: cached, isStale: false, isFresh: true };
    }
    if (age !== null && age <= MAX_STALE_MS) {
      // Stale (5-10min) → 返回舊數據 + 後台異步刷新
      const freshPromise = batchScrapeMarketStats([cardId.replace('snkrdunk_', '')], false);
      void freshPromise; // fire-and-forget，舊數據馬上回傳
      return { stats: cached, isStale: true, isFresh: false };
    }
  }

  // Very stale (> 10min) → 同步等待重新抓取
  const result = await batchScrapeMarketStats([cardId.replace('snkrdunk_', '')], true);
  const stats = result.data.get(cardId.replace('snkrdunk_', '')) ?? null;
  return { stats, isStale: false, isFresh: stats !== null };
}

// ─── Firestore Integration ────────────────────────────────────────────────────
// Bridge: snkrdunkBatchService → priceService → Firestore

/**
 * Converts SnkrdunkMarketStats → PriceRecord for priceService.updateProductPrice
 */
export function marketStatsToPriceRecord(stats: SnkrdunkMarketStats): PriceRecord {
  // median_sold_psa10 is in original currency (SG$/US$) — store as-is for now
  // median_sold_raw similarly
  return {
    psa10_price: stats.median_sold_psa10 ?? undefined,
    raw_price: stats.median_sold_raw ?? undefined,
    psa10_population: stats.sold_psa10_count ?? undefined,
    psa_pop_total: (stats.sold_psa10_count + stats.listed_psa10_count) || undefined,
    source: 'scraper',
  };
}

/**
 * Batch-writes market stats for multiple cards to Firestore in ONE writeBatch.
 * Uses writeBatch (not individual setDoc) to minimize network round-trips.
 *
 * @param results      BatchScrapeResult from batchScrapeMarketStats()
 * @param targetCollection  'pokeca_gold' | 'new_products' | 'products'
 */
export async function batchSyncToFirestore(
  results: BatchScrapeResult,
  targetCollection: string = 'products'
): Promise<{ written: number; failed: number }> {
  const written = 0;
  const failed = 0;

  if (results.data.size === 0) {
    return { written, failed };
  }

// Use Date for timestamps in Node.js context (serverTimestamp requires Firebase Client context)
  const batch = writeBatch(db);
  const now = new Date();

  for (const [rawId, stats] of results.data.entries()) {
    try {
      const docId = `snkrdunk_${rawId}`;
      const record = marketStatsToPriceRecord(stats);
      const productRef = doc(db, targetCollection, docId);

      // ── Main doc update (use set with merge for new docs) ──────────────────
      batch.set(
        productRef,
        {
          market_data: {
            psa10_price: record.psa10_price ?? null,
            raw_price: record.raw_price ?? null,
            psa10_population: record.psa10_population ?? null,
            psa_pop_total: record.psa_pop_total ?? null,
            last_updated: new Date().toISOString(),
            source: 'snkrdunk_batch',
            updatedAt: now,
          },
          updatedBy: 'scraper',
          last_history_sync: new Date().toISOString(),
        },
        { merge: true }
      );

      // ── price_history subcollection (atomic) ─────────────────────────────
      // Use addDoc via batch.create equivalent — set a new doc with auto-id
      const historyRef = collection(db, targetCollection, docId, 'price_history');
      const historyDocRef = doc(historyRef); // auto-id document reference
      batch.set(historyDocRef, {
        psa10_price: record.psa10_price ?? null,
        raw_price: record.raw_price ?? null,
        source: 'snkrdunk_batch',
        createdAt: now,
      });
    } catch (err) {
      console.warn(`[BatchSync] Skipped ${rawId}:`, err);
      // Don't fail the whole batch — skip this card
    }
  }

  try {
    await batch.commit();
    return { written: results.data.size, failed: results.failedIds.length };
  } catch (err) {
    console.error('[BatchSync] writeBatch.commit failed:', err);
    return { written: 0, failed: results.data.size };
  }
}

// ─── SWR Locking Mechanism ─────────────────────────────────────────────────────

// In-flight refresh locks to prevent duplicate batch scrapes for the same card
const refreshLocks = new Map<string, Promise<void>>();

/**
 * Returns a promise that resolves when a refresh lock is released.
 * If another refresh is already in-flight for this cardId, returns the existing promise.
 */
function getRefreshLock(cardId: string): Promise<void> | null {
  return refreshLocks.get(cardId) ?? null;
}

function acquireRefreshLock(cardId: string, promise: Promise<void>): void {
  refreshLocks.set(cardId, promise);
  void promise.finally(() => refreshLocks.delete(cardId));
}

/**
 * syncMarketDataForCard — SWR bridge for single card.
 *
 * Behavior:
 *  - Fresh (<5min):   return cached, NO Firestore write
 *  - Stale (5-10min): return cached immediately, fire-and-forget background refresh
 *  - Max stale (>10min) or forceRefresh: block until fresh data, then write to Firestore
 *
 * Returns: { stats, isStale, isFresh, wroteToFirestore }
 */
export async function syncMarketDataForCard(
  cardId: string,
  forceRefresh = false
): Promise<{
  stats: SnkrdunkMarketStats | null;
  isStale: boolean;
  isFresh: boolean;
  wroteToFirestore: boolean;
}> {
  const rawId = cardId.replace('snkrdunk_', '');

  // Check if another refresh is already in-flight for this card
  const existingLock = getRefreshLock(rawId);
  if (existingLock && !forceRefresh) {
    // Wait for the in-flight refresh to complete, then return cached
    await existingLock.catch(() => {});
    const cached = getCachedStats(rawId);
    return {
      stats: cached,
      isStale: false,
      isFresh: cached !== null,
      wroteToFirestore: false,
    };
  }

  // Determine freshness
  const cached = getCachedStats(rawId);
  const age = getCacheAge(rawId);

  if (!forceRefresh && cached) {
    if (age !== null && age <= STALE_THRESHOLD_MS) {
      // Fresh — no Firestore write (avoid redundant writes)
      return { stats: cached, isStale: false, isFresh: true, wroteToFirestore: false };
    }
    if (age !== null && age <= MAX_STALE_MS) {
      // Stale (5-10min) — return cached + background refresh
      const bgRefresh = (async () => {
        const lockPromise = batchScrapeMarketStats([rawId], false)
          .then(r => batchSyncToFirestore(r));
        acquireRefreshLock(rawId, lockPromise);
        await lockPromise;
      })();
      void bgRefresh; // fire-and-forget
      return { stats: cached, isStale: true, isFresh: false, wroteToFirestore: false };
    }
  }

  // Very stale (>10min) or forceRefresh — acquire lock and block
  const refreshPromise = (async () => {
    const result = await batchScrapeMarketStats([rawId], forceRefresh);
    await batchSyncToFirestore(result);
  })();

  acquireRefreshLock(rawId, refreshPromise);
  await refreshPromise;

  const freshStats = getCachedStats(rawId);
  return {
    stats: freshStats,
    isStale: false,
    isFresh: freshStats !== null,
    wroteToFirestore: true,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}