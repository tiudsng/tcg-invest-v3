/**
 * scraper_pokeca.cjs — Omni-Scraper V2
 * 用途: 從 pokeca-chart.com 同步 TCG PSA 價格到 Firestore
 * 架構: TcgScraperBase (OOP, lazy loading, batch write)
 * 
 * 用法:
 *   node scraper_pokeca.cjs                    # 全量同步 pokeca_gold
 *   node scraper_pokeca.cjs --limit 50         # 前 50 張
 *   node scraper_pokeca.cjs --target leaderboard  # 同步 leaderboard
 */

const https = require('https');
const os = require('os');

// ─── Herman Proxy 適配器 (Canary Test) ────────────────────────────────────────
const { HermanProxy } = require('./herman-proxy-adapter.cjs');
const proxy = new HermanProxy({ timeout: 45000 });

// 封裝 httpGet：優先使用 Herman Proxy，失敗時 fallback 到原生 https
const _originalHttpGet = httpGet; // 保存原始函數
httpGet = async function(url) {
  try {
    // 只代理 pokeca-chart.com 的請求
    if (url.includes('pokeca-chart.com')) {
      const result = await proxy.get(url, { target: 'standard_bot', timeout: 45000 });
      if (result.success && result.content !== null) {
        return result.content;
      }
    }
  } catch (e) {
    // Herman Proxy 不可用，fallback 到原始 https
  }
  return _originalHttpGet(url);
};

// ─── Apple Style Logger ───────────────────────────────────────────────────────

const LINE = '─';
const W = 46;

function bar() {
  return LINE.repeat(W);
}

function fmtCard(name, psa10, raw, psa10_pct, old) {
  const pct = old ? `(${(psa10 > old.price ? '↑' : psa10 < old.price ? '↓' : '-')}${old.price > 0 ? Math.abs(Math.round((psa10 - old.price) / old.price * 100)) + '%' : ' '})` : '(new)';
  const line = `○ ${name} [PSA 10] → $${psa10.toLocaleString()} ${pct}`;
  return line.slice(0, W);
}

function fmtFail(name, reason) {
  return `✗ ${name} → ${reason}`.slice(0, W);
}

function formatDuration(ms) {
  return (ms / 1000).toFixed(1);
}

// ─── Constants ───────────────────────────────────────────────────────────────

const JPY_TO_HKD = 0.049815;
const POKECA_API = 'https://pokeca-chart.com/ch/php';

const CONCURRENCY = parseInt(process.argv.includes('--fast') ? '20' : '3'); // IP protection: low concurrency
const BATCH_SIZE = 50;
const ARCHIVE_DIR = __dirname + '/archive';

// ─── Shared HTTP Client ───────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ─── Pokeca API ──────────────────────────────────────────────────────────────

async function resolveItemId(slug) {
  if (!slug) return -1;
  const data = await httpGet(`${POKECA_API}/get-item-id.php?slug=${encodeURIComponent(slug)}`);
  const id = parseInt(data.trim().replace(/"/g, ''), 10);
  return isNaN(id) ? -1 : id;
}

async function getGradeInfo(itemId) {
  if (itemId <= 0) return null;
  const data = await httpGet(`${POKECA_API}/get.php?function=get_item_grd_info&item_id=${itemId}`);
  try {
    const arr = JSON.parse(data);
    return arr[0] || null;
  } catch { return null; }
}

// ─── Price Parser ────────────────────────────────────────────────────────────

function parsePriceJpy(str) {
  if (!str || str === '-' || str === '') return 0;
  if (typeof str === 'number') return str;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

function jpyToHkd(jpy) {
  return Math.round(jpy * JPY_TO_HKD);
}

// ─── TcgScraperBase ─────────────────────────────────────────────────────────

class TcgScraperBase {
  JPY_TO_HKD = JPY_TO_HKD;

  constructor(credPath, projectId, dbId) {
    this.credPath = credPath;
    this.db = null; // lazy
    this.projectId = projectId;
    this.dbId = dbId;
  }

  _getDb() {
    if (!this.db) {
      const { Firestore } = require('@google-cloud/firestore');
      this.db = new Firestore({ credentials: require(this.credPath), projectId: this.projectId, databaseId: this.dbId });
    }
    return this.db;
  }

  async batchProcess(items, concurrency, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      results.push(...await Promise.all(batch.map(fn)));
      if (i + concurrency < items.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    return results;
  }

  transform(docData, gradeInfo) { throw new Error('Abstract'); }
  buildSlug(docData) { throw new Error('Abstract'); }

  async syncDocs(docs, options = {}) {
    const { onCard, dryRun = false } = options;
    const start = Date.now();
    const results = { found: 0, fetched: 0, written: 0, failed: 0, cards: [] };

    // Phase 1: Resolve item_ids
    const withId = await this.batchProcess(docs, CONCURRENCY, async (doc) => {
      const slug = this.buildSlug(doc.data());
      if (!slug) return null;
      const itemId = await resolveItemId(slug);
      if (itemId <= 0) return null;
      results.found++;
      process.stdout.write('█');
      return { doc, itemId, slug };
    });

    // Phase 2: Fetch grade info
    const withGrade = await this.batchProcess(withId.filter(Boolean), CONCURRENCY, async (entry) => {
      const info = await getGradeInfo(entry.itemId);
      if (!info) return null;
      results.fetched++;
      process.stdout.write('█');
      return { ...entry, gradeInfo: info };
    });

    // Phase 3: Batch write
    const valid = withGrade.filter(Boolean);
    if (!dryRun && valid.length > 0) {
      const db = this._getDb();
      for (let i = 0; i < valid.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const entry of valid.slice(i, i + BATCH_SIZE)) {
          const fields = this.transform(entry.doc.data(), entry.gradeInfo);
          if (fields) {
            batch.update(entry.doc.ref, fields);
            results.written++;
            results.cards.push({
              name: entry.doc.data().name_jp || entry.doc.data().name_en || entry.doc.id,
              psa10: fields.price,
              raw: fields.market_data?.raw_price || 0,
              old: null,
            });
          }
        }
        await batch.commit();
      }
    }

    results.duration = Date.now() - start;
    return results;
  }
}

// ─── PokecaGoldScraper ───────────────────────────────────────────────────────

class PokecaGoldScraper extends TcgScraperBase {
  constructor() {
    super(
      '/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json',
      'gen-lang-client-0326385388',
      'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
    );
  }

  buildSlug(docData) {
    return docData.slug || null;
  }

  transform(docData, gradeInfo) {
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
        source: 'omni-scraper-v2',
        updatedAt: now,
      }
    };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({
    credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
    projectId: 'gen-lang-client-0326385388',
    databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
  });

  const args = process.argv.slice(2);
  const isFast = args.includes('--fast');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  const scraper = new PokecaGoldScraper();
  const startTime = Date.now();

  console.log('\n');
  console.log(` ${bar()}`);
  console.log(`  TCG INVEST  |  Market Sync${isFast ? ' [FAST]' : ' [SAFE: 3 concurrent]'}`);
  console.log(` ${bar()}`);

  // Load docs
  let query = db.collection('pokeca_gold').where('slug', '!=', null);
  const snap = await query.get();
  const docs = snap.docs.filter(d => {
    const slug = d.data().slug;
    return slug && slug.trim() && slug !== 'undefined' && slug !== 'null';
  });
  const targetDocs = limit ? docs.slice(0, limit) : docs;

  console.log(` ${bar()}`);
  console.log(`  Source: pokeca-chart.com`);
  console.log(`  Target: ${targetDocs.length}${limit ? ` (limited from ${docs.length})` : ` / ${docs.length} available`} cards`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(` ${bar()}`);
  console.log('');

  const result = await scraper.syncDocs(targetDocs, { dryRun: false });

  const mem = process.memoryUsage();
  const ramMB = Math.round(mem.rss / 1024 / 1024);

  // Summary
  console.log('');
  console.log(` ${bar()}`);
  const duration = formatDuration(result.duration);
  if (result.cards.length > 0) {
    console.log(`  [SUCCESS]  ${result.written} Cards Updated (${duration}s)`);
    console.log(` ${bar()}`);
    console.log(`  Details${bar().slice(8)}`);
    for (const card of result.cards.slice(0, 10)) {
      const arrow = card.old ? (card.psa10 > card.old.price ? '↑' : card.psa10 < card.old.price ? '↓' : '-') : '+';
      const pct = card.old && card.old.price > 0
        ? Math.abs(Math.round((card.psa10 - card.old.price) / card.old.price * 100))
        : 0;
      const pctStr = card.old ? `(${arrow}${pct > 0 ? pct + '%' : ' '})` : '(new)';
      console.log(`  ○ ${card.name.slice(0, 22).padEnd(22)} $${card.psa10.toLocaleString().padStart(7)} ${pctStr}`);
    }
    if (result.cards.length > 10) {
      console.log(`  ...and ${result.cards.length - 10} more`);
    }
  } else {
    console.log(`  [SYNC] ${result.found} found / ${result.fetched} fetched / ${result.written} written`);
  }
  console.log(` ${bar()}`);
  console.log(`  Memory: ${ramMB}MB  |  Engine: Omni-Scraper V2`);
  console.log(`  Failed: ${result.failed + (targetDocs.length - result.found)}`);
  console.log(` ${bar()}`);
  console.log('');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });