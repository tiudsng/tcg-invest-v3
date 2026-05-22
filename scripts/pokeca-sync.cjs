/**
 * pokeca-sync.cjs — TCG Pokeca Price Synchronizer
 * ================================================
 * 合併：scraper_pokeca.cjs + scraper_pricecharting.cjs + herman-proxy-adapter.cjs
 *
 * 架構：
 *   • Browser-based (Herman Proxy) — 爬 pokeca-chart.com
 *   • API-based (pokeca two-phase) — slug → item_id → price
 *   • Slug Fuzzer — 自動修正失敗的 slug
 *   • Captcha Monitor — checkpoint + TG 警報
 *
 * 匯率：tcg-global-utils.cjs 的 jpyToHkd()（SSOT，0.0512）
 * 指紋池：config 頂部，熱更替
 *
 * 用法：
 *   node pokeca-sync.cjs                    # 全量同步
 *   node pokeca-sync.cjs --limit 50         # 前 50 張
 *   node pokeca-sync.cjs --dry-run          # 測試模式
 *   node pokeca-sync.cjs --target pokeca_gold  # 指定 collection
 *   node pokeca-sync.cjs --fuzz             # 僅運行 Slug Fuzzer
 */

// ─── 指紋池（熱更替）────────────────────────────────────────────────────────

const FINGERPRINT_POOL = [
  {
    name: 'chrome120_win11',
    target: 'chrome120',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    name: 'safari15_5_mac Monterey',
    target: 'safari15_5',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15',
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    name: 'edge101_win10',
    target: 'edge101',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.56',
    acceptLanguage: 'en-GB,en;q=0.9',
  },
  {
    name: 'firefox110_win11',
    target: 'firefox110',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0',
    acceptLanguage: 'en-US,en;q=0.9',
  },
];

let _fpIndex = 0;
function nextFingerprint() {
  const fp = FINGERPRINT_POOL[_fpIndex % FINGERPRINT_POOL.length];
  _fpIndex++;
  return fp;
}

// ─── Herman Proxy 適配器（內嵌）────────────────────────────────────────────

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 18765;
const PROXY_TIMEOUT = 45000;

class HermanProxy {
  constructor(options = {}) {
    this.host = options.host || PROXY_HOST;
    this.port = options.port || PROXY_PORT;
    this.timeout = options.timeout || PROXY_TIMEOUT;
  }

  async get(url, options = {}) {
    const { target = 'standard_bot', session_id = null, params = null, timeout = this.timeout } = options;
    const fp = nextFingerprint();
    const queryParams = new URLSearchParams({ url, target: fp.target });
    if (session_id) queryParams.set('session_id', session_id);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        queryParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
      }
    }

    const [host, port] = [this.host, this.port];
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: host, port, path: `/fetch?${queryParams.toString()}`, method: 'GET', timeout }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Parse error: ${body.slice(0, 100)}`)); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${timeout}ms`)); });
      req.end();
    });
  }

  async post(url, { data = null, json_data = null, target = 'standard_bot', session_id = null, timeout = this.timeout } = {}) {
    const fp = nextFingerprint();
    const postData = JSON.stringify({ url, method: 'POST', target: fp.target, session_id, data, json_data });
    const [host, port] = [this.host, this.port];
    return new Promise((resolve, reject) => {
      const req = http.request({ hostname: host, port, path: '/fetch', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }, timeout }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error(`Parse error: ${body.slice(0, 100)}`)); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${timeout}ms`)); });
      req.write(postData);
      req.end();
    });
  }
}

// ─── Slug Fuzzer（內嵌）──────────────────────────────────────────────────────

function generateSlugVariants(slug) {
  const variants = new Set();
  if (!slug) return variants;

  variants.add(slug);

  // 補零/去零：sv2d-93 <-> sv2d-093
  const m = slug.match(/^([a-z]+)(\d+)-(\d+)$/i);
  if (m) {
    const [, prefix, firstNum, secondNum] = m;
    if (secondNum.length === 2) variants.add(`${prefix}${firstNum}-${secondNum.padStart(3, '0')}`);
    if (secondNum.length === 3 && secondNum.startsWith('0')) variants.add(`${prefix}${firstNum}-${secondNum.replace(/^0+/, '')}`);
  }

  // 另一種模式：s12a-261
  const m2 = slug.match(/^([a-z]+\d+[a-z]?)-(\d+)$/i);
  if (m2) {
    const [, prefix, num] = m2;
    if (num.length === 2) variants.add(`${prefix}-${num.padStart(3, '0')}`);
    if (num.length === 3 && num.startsWith('0')) variants.add(`${prefix}-${num.replace(/^0+/, '')}`);
  }

  // SAR/RR/HR 變體
  const base = slug.replace(/-(sar|rr|hr|a|b)$/i, '');
  for (const s of ['sar', 'rr', 'hr', 'a', 'b']) {
    variants.add(`${base}-${s}`);
  }

  // _ 取代 -
  variants.add(slug.replace('-', '_'));

  return variants;
}

function fuzzSlug(proxy, slug) {
  const variants = generateSlugVariants(slug);
  for (const variant of variants) {
    const r = proxy.get(`${POKECA_API}/get-item-id.php?slug=${encodeURIComponent(variant)}`, { target: 'standard_bot' }).catch(() => null);
    if (r && r.success && r.content) {
      const id = parseInt(String(r.content).replace(/"/g, '').trim(), 10);
      if (id > 0) return { variant, itemId: id };
    }
  }
  return { variant: null, itemId: -1 };
}

// ─── Captcha Checkpoint ──────────────────────────────────────────────────────

const CHECKPOINT_PATH = '/home/ubuntu/.hermes/sessions/captcha_checkpoint.json';

function writeCheckpoint(pid, action) {
  const { spawn } = require('child_process');
  const data = JSON.stringify({ pid, action, ts: Date.now() });
  require('fs').writeFileSync(CHECKPOINT_PATH, data);
}

function clearCheckpoint() {
  try { require('fs').unlinkSync(CHECKPOINT_PATH); } catch {}
}

function readCheckpoint() {
  try {
    const raw = require('fs').readFileSync(CHECKPOINT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

async function sendTelegramAlert(caption) {
  const token = process.env.TG_BOT_TOKEN || '8642765029:AAE3kn8_28mPOlWLC_4xfNs-RtQje9XCOm8';
  const chatId = '8217991576';
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const { execSync } = require('child_process');
    execSync(`curl -s -X POST "${url}" -d "chat_id=${chatId}" -d "text=${encodeURIComponent(caption)}"`, { timeout: 10000 });
  } catch {}
}

// ─── 核心工具（引用 tcg-global-utils）───────────────────────────────────────

const http = require('http');
const os = require('os');
const path = require('path');

// 嘗試載入 SSOT 匯率工具（失敗時降級）
let jpyToHkd, parsePriceJpy;
try {
  const utils = require('/home/ubuntu/.hermes/skills/tcginvest/tcg-global-utils.cjs');
  jpyToHkd = utils.jpyToHkd;
  parsePriceJpy = utils.parsePriceJpy;
} catch {
  // 降級：使用 SKILL.md 確認的 0.0512
  const JPY_TO_HKD_FALLBACK = 0.0512;
  jpyToHkd = (jpy) => Math.round(jpy * JPY_TO_HKD_FALLBACK);
  parsePriceJpy = (str) => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
  };
}

// ─── 常量 ───────────────────────────────────────────────────────────────────

const POKECA_API = 'https://pokeca-chart.com/ch/php';
const CONCURRENCY = parseInt(process.argv.includes('--fast') ? '20' : '3');
const BATCH_SIZE = 50;

// Firestore
const PROJECT_ID = 'gen-lang-client-0326385388';
const DB_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const CRED_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || '/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json';

// ─── Logger ─────────────────────────────────────────────────────────────────

const BAR = '─'.repeat(46);

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function fmtDuration(ms) { return (ms / 1000).toFixed(1) + 's'; }

// ─── Atomic 兩階段請求 ──────────────────────────────────────────────────────

/**
 * fetchWithRetry：Pokeca 兩階段原子性包裝器
 *
 * Phase 1: slug → item_id
 * Phase 2: item_id → grade info
 *
 * 如果 Phase 2 失敗，狀態回滾（不留下殘缺文檔）
 * 每階段自帶重試（最多 3 次，exponential backoff）
 */
async function fetchWithRetry(proxy, slug, options = {}) {
  const { maxRetries = 3, baseDelayMs = 2000, onCaptcha } = options;
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // ── Phase 1: slug → item_id ─────────────────────────────────
    let itemId = -1;
    let resolvedSlug = slug;

    // Slug Fuzzer 如果主要 slug 失敗
    const phase1Result = await proxy.get(
      `${POKECA_API}/get-item-id.php?slug=${encodeURIComponent(slug)}`,
      { target: 'standard_bot', timeout: 15000 }
    ).catch((e) => ({ success: false, error: e.message }));

    if (!phase1Result.success || !phase1Result.content) {
      lastError = phase1Result.error || 'Phase1 no content';
    } else {
      itemId = parseInt(String(phase1Result.content).replace(/"/g, '').trim(), 10);
      if (itemId <= 0) {
        // Slug Fuzzer
        const fuzz = fuzzSlug(proxy, slug);
        if (fuzz.itemId > 0) {
          resolvedSlug = fuzz.variant;
          itemId = fuzz.itemId;
        }
      }
    }

    if (itemId <= 0) {
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log(`  ⏳ [${slug}] Phase1 retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${lastError}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { success: false, phase: 1, slug, error: lastError };
    }

    // ── Phase 2: item_id → grade info ──────────────────────────
    const phase2Result = await proxy.get(
      `${POKECA_API}/get.php?function=get_item_grd_info&item_id=${itemId}`,
      { target: 'standard_bot', timeout: 20000 }
    ).catch((e) => ({ success: false, error: e.message }));

    if (!phase2Result.success || !phase2Result.content) {
      lastError = phase2Result.error || 'Phase2 no content';
      // Captcha 檢測
      if (onCaptcha && phase2Result.error && phase2Result.error.includes('captcha')) {
        onCaptcha(slug);
      }
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log(`  ⏳ [${slug}] Phase2 retry ${attempt + 1}/${maxRetries} after ${delay}ms — ${lastError}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { success: false, phase: 2, slug, itemId, error: lastError };
    }

    try {
      const arr = JSON.parse(phase2Result.content);
      const gradeInfo = arr[0];
      if (!gradeInfo) {
        lastError = 'gradeInfo null';
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
          continue;
        }
        return { success: false, phase: 2, slug, itemId, error: 'gradeInfo null' };
      }
      return { success: true, slug: resolvedSlug, itemId, gradeInfo };
    } catch (e) {
      lastError = `Parse error: ${e.message}`;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
        continue;
      }
      return { success: false, phase: 2, slug, itemId, error: lastError };
    }
  }

  return { success: false, phase: 'exhausted', slug, error: lastError };
}

// ─── PokecaGoldScraper ──────────────────────────────────────────────────────

class PokecaGoldScraper {
  constructor() {
    this.proxy = new HermanProxy();
    this.db = null;
  }

  _getDb() {
    if (!this.db) {
      const { Firestore } = require('@google-cloud/firestore');
      this.db = new Firestore({
        credentials: require(CRED_PATH),
        projectId: PROJECT_ID,
        databaseId: DB_ID,
      });
    }
    return this.db;
  }

  /**
   * 同步文檔（原子性：兩階段都成功才寫入）
   */
  async syncDocs(docs, options = {}) {
    const { dryRun = false, onCard } = options;
    const start = Date.now();
    const results = { found: 0, fetched: 0, written: 0, failed: 0, cards: [] };

    for (let i = 0; i < docs.length; i += CONCURRENCY) {
      const batch = docs.slice(i, i + CONCURRENCY);

      const entries = await Promise.all(
        batch.map(async (doc) => {
          const slug = doc.data().slug || null;
          if (!slug || slug === 'undefined' || slug === 'null') return null;

          const cp = { pid: process.pid, action: `pokeca-sync:${slug}` };
          writeCheckpoint(cp.pid, cp.action);

          const result = await fetchWithRetry(this.proxy, slug, {
            onCaptcha: (s) => {
              log(`⚠️  Captcha detected for: ${s}`);
              sendTelegramAlert(`⚠️ Captcha Alert: pokeca-sync 遇到 ${s}`);
            }
          });

          clearCheckpoint();

          if (!result.success) {
            results.failed++;
            log(`✗ ${slug} → Phase${result.phase} failed: ${result.error}`);
            return null;
          }

          results.found++;
          results.fetched++;
          process.stdout.write('█');

          return { doc, ...result };
        })
      );

      // Phase 3: Batch write（只有兩階段都成功才寫入）
      const valid = entries.filter(Boolean);
      if (!dryRun && valid.length > 0) {
        const db = this._getDb();
        for (let j = 0; j < valid.length; j += BATCH_SIZE) {
          const batch = db.batch();
          for (const entry of valid.slice(j, j + BATCH_SIZE)) {
            const fields = this._transform(entry.doc.data(), entry.gradeInfo);
            if (fields) {
              batch.update(entry.doc.ref, fields);
              results.written++;
              results.cards.push({
                name: entry.doc.data().name_jp || entry.doc.data().name_en || entry.doc.id,
                psa10: fields.price || 0,
                raw: fields.market_data?.raw_price || 0,
              });
            }
          }
          await batch.commit();
        }
      }

      if (i + CONCURRENCY < docs.length) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    results.duration = Date.now() - start;
    return results;
  }

  _transform(docData, gradeInfo) {
    const psa10Jpy = parsePriceJpy(gradeInfo.recent_price_2);
    const rawJpy = parsePriceJpy(gradeInfo.recent_price_0);
    const psa10Hkd = jpyToHkd(psa10Jpy);
    const rawHkd = jpyToHkd(rawJpy);

    const pop10 = parseInt(String(gradeInfo.grd_status_10 || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const popAll = parseInt(String(gradeInfo.grd_status_all || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const pct = popAll > 0 ? ((pop10 / popAll) * 100).toFixed(1) + '%' : '0%';
    const ratio = rawHkd > 0 ? parseFloat((psa10Hkd / rawHkd).toFixed(2)) : 0;
    const now = new Date().toISOString();

    return {
      price: psa10Hkd,
      psa_all: popAll,
      psa10: pop10,
      psa10_pct: pct,
      psa10_raw_ratio: ratio,
      updatedAt: now,
      market_data: {
        psa10_price: psa10Hkd,
        raw_price: rawHkd,
        psa10_latest_jpy: psa10Jpy,
        raw_latest_jpy: rawJpy,
        psa_pop_10: pop10,
        psa_pop_total: popAll,
        psa_pop_10_percent: pct,
        source: 'pokeca-sync-v1',
        updatedAt: now,
      },
    };
  }
}

// ─── Slug Fuzzer 獨立模式 ───────────────────────────────────────────────────

async function runSlugFuzzer() {
  log('🔍 Slug Fuzzer Mode');
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ credentials: require(CRED_PATH), projectId: PROJECT_ID, databaseId: DB_ID });

  const snap = await db.collection('pokeca_gold').where('slug', '!=', null).get();
  const docs = snap.docs.filter((d) => {
    const slug = d.data().slug;
    return slug && slug.trim() && slug !== 'undefined' && slug !== 'null';
  });

  log(`Scanning ${docs.length} docs...`);
  const proxy = new HermanProxy();
  const invalid = [];

  for (const doc of docs) {
    const slug = doc.data().slug;
    const r = await proxy.get(`${POKECA_API}/get-item-id.php?slug=${encodeURIComponent(slug)}`, { target: 'standard_bot' }).catch(() => null);
    const content = r?.content;
    const itemId = content ? parseInt(String(content).replace(/"/g, '').trim(), 10) : -1;
    if (itemId <= 0) invalid.push({ docId: doc.id, slug, name: doc.data().name_jp || doc.data().name_en || 'N/A' });
  }

  log(`Found ${invalid.length} invalid slugs`);
  const fixed = [];

  for (const { docId, slug, name } of invalid.slice(0, 20)) {
    log(`  Fuzzing: ${slug} (${name.slice(0, 20)})`);
    const { variant, itemId } = fuzzSlug(proxy, slug);
    if (itemId > 0) {
      await db.collection('pokeca_gold').doc(docId).update({ slug: variant });
      log(`  ✅ ${slug} → ${variant} (item_id=${itemId})`);
      fixed.push({ docId, slug, variant, itemId });
    } else {
      log(`  ❌ No variant found`);
    }
  }

  log(`\n📝 Fixed: ${fixed.length}/${invalid.length}`);
  if (fixed.length < invalid.length) {
    const unfixed = invalid.slice(fixed.length);
    require('fs').writeFileSync('/tmp/unfixed_slugs.json', JSON.stringify(unfixed, null, 2));
    log(`⚠️  ${unfixed.length} unfixed → /tmp/unfixed_slugs.json`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isFast = args.includes('--fast');
  const isDryRun = args.includes('--dry-run');
  const isFuzzMode = args.includes('--fuzz');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const targetArg = args.find((a) => a.startsWith('--target='));
  const collection = targetArg ? targetArg.split('=')[1] : 'pokeca_gold';

  if (isFuzzMode) {
    await runSlugFuzzer();
    return;
  }

  const scraper = new PokecaGoldScraper();
  const db = scraper._getDb();

  console.log('\n ' + BAR);
  console.log(`  TCG INVEST  |  Pokeca Sync${isFast ? ' [FAST]' : ''}${isDryRun ? ' [DRY-RUN]' : ''}`);
  console.log(' ' + BAR);
  console.log(`  Source: pokeca-chart.com (via Herman Proxy)`);
  console.log(`  Target: ${collection}`);
  console.log(`  Fingerprints: ${FINGERPRINT_POOL.length} in pool`);
  console.log(`  Rate: jpyToHkd() from tcg-global-utils.cjs (SSOT)`);
  console.log(' ' + BAR);
  console.log('');

  const snap = await db.collection(collection).where('slug', '!=', null).get();
  const docs = snap.docs.filter((d) => {
    const slug = d.data().slug;
    return slug && slug.trim() && slug !== 'undefined' && slug !== 'null';
  });
  const targetDocs = limit ? docs.slice(0, limit) : docs;

  console.log(`  Fetching: ${targetDocs.length}${limit ? ` (limited from ${docs.length})` : ` / ${docs.length}`} cards`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log('');

  const result = await scraper.syncDocs(targetDocs, { dryRun: isDryRun });

  const ramMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

  console.log('');
  console.log(' ' + BAR);
  if (result.cards.length > 0) {
    console.log(`  [SUCCESS]  ${result.written} Cards Updated (${fmtDuration(result.duration)})`);
    console.log(' ' + BAR);
    console.log('  Details');
    for (const card of result.cards.slice(0, 10)) {
      console.log(`  ○ ${card.name.slice(0, 22).padEnd(22)} HK$${card.psa10.toLocaleString().padStart(7)}`);
    }
    if (result.cards.length > 10) console.log(`  ...and ${result.cards.length - 10} more`);
  } else {
    console.log(`  [SYNC] ${result.found} found / ${result.fetched} fetched / ${result.written} written / ${result.failed} failed`);
  }
  console.log(' ' + BAR);
  console.log(`  Memory: ${ramMB}MB  |  Source: pokeca-sync-v1`);
  console.log(' ' + BAR);
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});