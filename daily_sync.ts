/**
 * daily_sync.ts — TCG INVEST 自動化每日同步
 * 
 * 功能：
 * 1. 增量更新：只抓取 market_data.last_updated 超過 24 小時的卡片
 * 2. 映射校驗：每 7 天重新解析一次 mapping（防止連結失效）
 * 3. 健康檢查：mapping 失敗率 > 10% → Telegram 通知
 * 4. 完整日誌：JSON Lines 格式輸出，方便 cron job 捕獲
 * 
 * 觸發方式：
 *   npx tsx daily_sync.ts                    # 標準增量同步
 *   npx tsx daily_sync.ts --full             # 強制全量更新（忽略 cache）
 *   npx tsx daily_sync.ts --mapping-only     # 只做映射校驗，不抓價格
 *   npx tsx daily_sync.ts --health-check      # 只做健康檢查
 */

import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { db } from './src/firebase';
import { batchScrapeMarketStats, batchSyncToFirestore, type BatchScrapeResult } from './src/lib/snkrdunkBatchService';
import { batchResolveAndStore, parseInternalId, type MappingResult } from './src/lib/idMappingService';

// ─── Env ──────────────────────────────────────────────────────────────────────

const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN ?? '8642765029:AAE3kn8_28mPOlWLC_4xfNs-RtQje9XCOm8';
const ADMIN_CHAT  = process.env.ADMIN_CHAT_ID      ?? '8217991576';
const STALE_HOURS = 24;   // 超過 N 小時視為需更新
const MAP_EVERY_DAYS = 7; // 每 N 天重新校驗 mapping

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncCard {
  internalId: string;
  docId: string;
  snkrdunkId: string | null;
  lastUpdated: string | null;
  hasMarketData: boolean;
}

interface SyncResult {
  timestamp: string;
  mode: string;
  total: number;
  price_updated: number;
  price_failed: number;
  mapping_checked: number;
  mapping_failed: number;
  mapping_failed_rate: number;
  duration_ms: number;
  error?: string;
}

// ─── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(message: string): Promise<void> {
  try {
    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      chat_id: ADMIN_CHAT,
      text: message,
      parse_mode: 'Markdown',
    });
  } catch (err: any) {
    console.error('[TG] Failed to send:', err.message);
  }
}

// ─── Firestore Queries ───────────────────────────────────────────────────────

/**
 * 找出需要更新價格的卡片
 * 條件：last_updated 超過 STALE_HOURS 或 market_data 不存在
 */
async function getStaleCards(maxCount = 200): Promise<SyncCard[]> {
  const now = Date.now();
  const staleThreshold = new Date(now - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // Query products where:
  //   - market_data is missing, OR
  //   - market_data.last_updated < staleThreshold
  // Use orderBy + limit, then filter in-memory for the missing-field case
  // (Firestore can only do >= on existing fields)

  const q = query(
    collection(db, 'products'),
    orderBy('__name__'),  // arbitrary ordering for pagination
    limit(maxCount * 2)  // over-fetch then filter
  );

  const snap = await getDocs(q);
  const cards: SyncCard[] = [];

  for (const d of snap.docs) {
    if (cards.length >= maxCount) break;

    const data = d.data();
    const marketData = data.market_data as any;
    const lastUpdated = marketData?.last_updated ?? null;
    const snkrdunkId = data.external_ids?.snkrdunk ?? null;

    const needsUpdate = !lastUpdated || lastUpdated < staleThreshold;

    if (needsUpdate && snkrdunkId) {
      cards.push({
        internalId: d.id,
        docId: d.id,
        snkrdunkId,
        lastUpdated,
        hasMarketData: !!marketData,
      });
    }
  }

  return cards;
}

/**
 * 找出需要重新校驗 mapping 的卡片
 * 條件：超過 MAP_EVERY_DAYS 天未重新解析
 */
async function getCardsNeedingMappingRefresh(maxCount = 50): Promise<string[]> {
  const now = Date.now();
  const mapThreshold = new Date(now - MAP_EVERY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Find cards where external_ids.snkrdunk is set but lastResolved < threshold
  const q = query(
    collection(db, 'products'),
    where('external_ids.snkrdunk', '!=', null),
    limit(maxCount * 2)
  );

  const snap = await getDocs(q);
  const needsRefresh: string[] = [];

  for (const d of snap.docs) {
    if (needsRefresh.length >= maxCount) break;
    const data = d.data() as any;
    const lastResolved = data.external_ids?.lastResolved ?? null;
    if (!lastResolved || lastResolved < mapThreshold) {
      needsRefresh.push(d.id);
    }
  }

  return needsRefresh;
}

/**
 * 取得所有有 snkrdunk external ID 但缺少 market_data 的卡片
 */
async function getUnmappedCards(maxCount = 100): Promise<SyncCard[]> {
  const q = query(
    collection(db, 'products'),
    where('external_ids.snkrdunk', '!=', null),
    limit(maxCount)
  );

  const snap = await getDocs(q);
  const cards: SyncCard[] = [];

  for (const d of snap.docs) {
    const data = d.data() as any;
    if (!data.market_data) {
      cards.push({
        internalId: d.id,
        docId: d.id,
        snkrdunkId: data.external_ids?.snkrdunk ?? null,
        lastUpdated: null,
        hasMarketData: false,
      });
    }
  }

  return cards;
}

// ─── Core Sync ───────────────────────────────────────────────────────────────

async function syncPricesForCards(cards: SyncCard[], forceRefresh = false): Promise<{
  updated: number;
  failed: number;
}> {
  if (cards.length === 0) return { updated: 0, failed: 0 };

  const snkrdunkIds = cards
    .map(c => c.snkrdunkId)
    .filter((id): id is string => id !== null);

  console.log(`[PriceSync] Scraping ${snkrdunkIds.length} cards...`);

  const result: BatchScrapeResult = await batchScrapeMarketStats(snkrdunkIds, forceRefresh);

  // Write results to Firestore
  const { written, failed } = await batchSyncToFirestore(result);

  return { updated: written, failed };
}

async function refreshMappings(internalIds: string[]): Promise<{
  success: number;
  failed: number;
  failedRate: number;
}> {
  if (internalIds.length === 0) return { success: 0, failed: 0, failedRate: 0 };

  // Parse setCode + cardNum from internal ID
  const entries = internalIds
    .map(id => {
      const parsed = parseInternalId(id);
      if (!parsed) return null;
      return { internalId: id, ...parsed };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) return { success: 0, failed: 0, failedRate: 0 };

  console.log(`[Mapping] Refreshing ${entries.length} mappings...`);

  const results = await batchResolveAndStore(entries, { forceRefresh: true });

  const failedRate = entries.length > 0 ? results.failed / entries.length : 0;

  return {
    success: results.success,
    failed: results.failed,
    failedRate,
  };
}

// ─── Health Check ────────────────────────────────────────────────────────────

async function runHealthCheck(): Promise<{ ok: boolean; details: string }> {
  const cards = await getStaleCards(50);
  const unmapped = await getUnmappedCards(50);

  const total = cards.length + unmapped.length;
  const pct = total > 0 ? Math.round((unmapped.length / total) * 100) : 0;

  const ok = pct < 20; // 警告閾值：20%

  return {
    ok,
    details: `Stale: ${cards.length} | Unmapped: ${unmapped.length} | Unmapped%: ${pct}%`,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();
  const mode = process.argv.includes('--full')
    ? 'full'
    : process.argv.includes('--mapping-only')
    ? 'mapping-only'
    : process.argv.includes('--health-check')
    ? 'health-check'
    : 'incremental';

  const result: SyncResult = {
    timestamp: new Date().toISOString(),
    mode,
    total: 0,
    price_updated: 0,
    price_failed: 0,
    mapping_checked: 0,
    mapping_failed: 0,
    mapping_failed_rate: 0,
    duration_ms: 0,
  };

  try {
    if (mode === 'health-check') {
      const health = await runHealthCheck();
      const emoji = health.ok ? '✅' : '⚠️';
      const msg = `${emoji} *Health Check*\n\`\`\`\n${health.details}\n\`\`\`\nMode: ${mode}`;
      console.log(msg);
      await sendTelegram(msg);
      return;
    }

    if (mode === 'mapping-only') {
      const stale = await getCardsNeedingMappingRefresh(50);
      const { success, failed, failedRate } = await refreshMappings(stale);
      result.mapping_checked = stale.length;
      result.mapping_failed = failed;
      result.mapping_failed_rate = failedRate;

      if (failedRate > 0.1) {
        await sendTelegram(
          `⚠️ *Mapping Health Alert*\n` +
          `Failed rate: ${Math.round(failedRate * 100)}% (threshold: 10%)\n` +
          `${failed} failed / ${stale.length} total`
        );
      }

      const duration = Date.now() - start;
      result.duration_ms = duration;
      console.log(JSON.stringify({ ...result, duration_ms: duration }));
      return;
    }

    // ── Incremental / Full ───────────────────────────────────────────────────

    // Step 1: Refresh mappings for stale ones
    const staleMappings = await getCardsNeedingMappingRefresh(30);
    if (staleMappings.length > 0) {
      const mapResult = await refreshMappings(staleMappings);
      result.mapping_checked = staleMappings.length;
      result.mapping_failed = mapResult.failed;
      result.mapping_failed_rate = mapResult.failedRate;

      if (mapResult.failedRate > 0.1) {
        await sendTelegram(
          `⚠️ *Mapping Health Alert*\n` +
          `Failed rate: ${Math.round(mapResult.failedRate * 100)}% (threshold: 10%)\n` +
          `${mapResult.failed} failed / ${staleMappings.length} total`
        );
      }
    }

    // Step 2: Sync prices for stale cards
    const staleCards = await getStaleCards(200);
    result.total = staleCards.length;

    if (staleCards.length > 0) {
      const forceRefresh = mode === 'full';
      const { updated, failed } = await syncPricesForCards(staleCards, forceRefresh);
      result.price_updated = updated;
      result.price_failed = failed;
    }

    // Step 3: Also sync cards that have mapping but no market data
    const unmapped = await getUnmappedCards(100);
    if (unmapped.length > 0) {
      const { updated, failed } = await syncPricesForCards(unmapped, false);
      result.price_updated += updated;
      result.price_failed += failed;
    }

  } catch (err: any) {
    result.error = err.message;
    console.error('[DailySync] Fatal error:', err.message);
    await sendTelegram(
      `🚨 *Daily Sync Failed*\n` +
      `Error: ${err.message}\n` +
      `Mode: ${mode}\n` +
      `Time: ${result.timestamp}`
    );
  }

  const duration = Date.now() - start;
  result.duration_ms = duration;

  // Emit JSON Lines to stdout (cron job can capture)
  console.log(JSON.stringify(result));

  // Summary to TG on success (only for full runs)
  if (!result.error && mode === 'full') {
    const emoji = result.price_failed === 0 ? '✅' : '⚠️';
    await sendTelegram(
      `${emoji} *Daily Sync Complete*\n` +
      `Mode: ${mode}\n` +
      `Price updated: ${result.price_updated}\n` +
      `Price failed: ${result.price_failed}\n` +
      `Mapping checked: ${result.mapping_checked}\n` +
      `Mapping failed: ${result.mapping_failed}\n` +
      `Duration: ${Math.round(duration / 1000)}s`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
