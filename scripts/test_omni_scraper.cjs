/**
 * test_omni_scraper.js — 小範圍壓力測試 (10 張卡)
 * 測試 omni_scraper_base 架構：一致的 API fetch + Firestore write
 * 
 * 目標：驗證新架構寫入數據與舊架構 100% 兼容
 */

const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

// ─── Constants ───────────────────────────────────────────────────────────────
const JPY_TO_HKD = 0.052;
const POKECA_API = 'https://pokeca-chart.com/ch/php';
const CONCURRENCY = 10;
const BATCH_SIZE = 10;

// ─── Shared HTTP Client ───────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const t = Date.now();
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, time: Date.now() - t }));
    }).on('error', reject);
  });
}

// ─── Pokeca API ──────────────────────────────────────────────────────────────

async function resolveItemId(slug) {
  const { data } = await httpGet(`${POKECA_API}/get-item-id.php?slug=${encodeURIComponent(slug)}`);
  const id = parseInt(data.trim().replace(/"/g, ''), 10);
  return isNaN(id) ? -1 : id;
}

async function getGradeInfo(itemId) {
  if (itemId <= 0) return null;
  const { data } = await httpGet(`${POKECA_API}/get.php?function=get_item_grd_info&item_id=${itemId}`);
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

// ─── TcgScraperBase (shared logic) ───────────────────────────────────────────

class TcgScraperBase {
  JPY_TO_HKD = JPY_TO_HKD;

  constructor(credPath, projectId, dbId) {
    this.credPath = credPath;
    this.db = new Firestore({ credentials: require(credPath), projectId, databaseId: dbId });
  }

  async batchProcess(items, concurrency, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
      if (i + concurrency < items.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    return results;
  }

  // Abstract: 子類實現
  transform(docData, gradeInfo) { throw new Error('Abstract'); }
  // Abstract: slug 生成策略
  buildSlug(setCode, cardNum) { throw new Error('Abstract'); }

  async syncDocs(docs) {
    console.log(`\n📡 [${this.constructor.name}] 準備同步 ${docs.length} 張卡...`);
    
    // Phase 1: Resolve item_ids
    const withId = await this.batchProcess(docs, CONCURRENCY, async (doc) => {
      const slug = this.buildSlug(doc.data());
      const itemId = await resolveItemId(slug);
      const ok = itemId > 0;
      process.stdout.write(ok ? '✓' : '✗');
      return ok ? { doc, itemId, slug } : null;
    });
    const found = withId.filter(x => x !== null);
    console.log(`\n   item_id found: ${found.length}/${docs.length}`);

    // Phase 2: Fetch grade info
    const withGrade = await this.batchProcess(found, CONCURRENCY, async (entry) => {
      const info = await getGradeInfo(entry.itemId);
      process.stdout.write(info ? '✓' : '✗');
      return info ? { ...entry, gradeInfo: info } : null;
    });
    const gotGrade = withGrade.filter(x => x !== null);
    console.log(`\n   grade_info fetched: ${gotGrade.length}/${found.length}`);

    // Phase 3: Batch write
    let written = 0;
    const batch = this.db.batch();
    for (const entry of gotGrade) {
      const fields = this.transform(entry.doc.data(), entry.gradeInfo);
      if (fields) {
        batch.update(entry.doc.ref, fields);
        written++;
      }
    }
    await batch.commit();
    console.log(`   ✅ Written: ${written}/${gotGrade.length}`);

    return { found: found.length, fetched: gotGrade.length, written };
  }
}

// ─── PokecaGoldScraper ────────────────────────────────────────────────────────

class PokecaGoldScraper extends TcgScraperBase {
  /**
   * 寫入 pokeca_gold collection
   * 欄位: price, psa10, psa_all, psa10_pct, psa10_raw_ratio, updatedAt, market_data.*
   */
  constructor() {
    super(
      '/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json',
      'gen-lang-client-0326385388',
      'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
    );
  }

  buildSlug(docData) {
    // pokeca_gold doc 已有 slug 欄位，直接用
    return docData.slug || null;
  }

  transform(docData, gradeInfo) {
    const psa10Jpy = parsePriceJpy(gradeInfo.recent_price_2);
    const rawJpy = parsePriceJpy(gradeInfo.recent_price_0);
    const psa10Hkd = jpyToHkd(psa10Jpy);
    const rawHkd = jpyToHkd(rawJpy);

    const pop10Str = String(gradeInfo.grd_status_10 || '0');
    const popAllStr = String(gradeInfo.grd_status_all || '0');
    const pop10 = parseInt(pop10Str.replace(/[^0-9]/g, ''), 10) || 0;
    const popAll = parseInt(popAllStr.replace(/[^0-9]/g, ''), 10) || 0;
    const pct = popAll > 0 ? ((pop10 / popAll) * 100).toFixed(1) + '%' : '0%';
    const ratio = rawHkd > 0 ? parseFloat((psa10Hkd / rawHkd).toFixed(2)) : 0;

    return {
      price: psa10Hkd,
      psa_all: popAll,
      psa10: pop10,
      psa10_pct: pct,
      psa10_raw_ratio: ratio,
      updatedAt: new Date().toISOString(),
      market_data: {
        psa10_price: psa10Hkd,
        raw_price: rawHkd,
        psa10_latest_jpy: psa10Jpy,
        raw_latest_jpy: rawJpy,
        psa_pop_10: pop10,
        psa_pop_total: popAll,
        psa_pop_10_percent: pct,
        source: 'omni-scraper-v2',
        updatedAt: new Date().toISOString(),
      }
    };
  }
}

// ─── 測試：對比新舊數據格式 ─────────────────────────────────────────────────

async function compareFormat(docRef, newFields, oldFields) {
  const snap = await docRef.get();
  const old = snap.data();
  const checks = [];

  for (const [key, newVal] of Object.entries(newFields)) {
    if (key === 'updatedAt') continue; // timestamp varies
    const oldVal = old[key];
    const match = JSON.stringify(oldVal) === JSON.stringify(newVal);
    checks.push({ key, match, old: oldVal, new: newVal });
  }

  return checks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = new Firestore({
    credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
    projectId: 'gen-lang-client-0326385388',
    databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
  });

  console.log('═══════════════════════════════════════════');
  console.log('  Omni-Scraper V2 小範圍壓力測試');
  console.log('  目標: 10 張有 slug 的 pokeca_gold docs');
  console.log('═══════════════════════════════════════════');

  // 讀取 10 張有 slug 的 doc
  const snap = await db.collection('pokeca_gold')
    .where('slug', '!=', null)
    .limit(10)
    .get();

  const testDocs = snap.docs.filter(d => {
    const slug = d.data().slug;
    return slug && slug.trim() !== '' && slug !== 'undefined';
  });

  console.log(`\n📋 測試樣本: ${testDocs.length} 張卡`);
  testDocs.forEach((d, i) => {
    const { set_code, card_number, slug } = d.data();
    console.log(`  ${i+1}. [${set_code}] ${card_number} → slug=${slug}`);
  });

  // 記錄舊資料 (Before)
  const beforeData = {};
  for (const doc of testDocs) {
    const s = await doc.ref.get();
    beforeData[doc.id] = s.data();
  }

  // 執行 Omni Scraper
  const scraper = new PokecaGoldScraper();
  const result = await scraper.syncDocs(testDocs);

  // 驗證 (After)
  console.log('\n🔍 格式一致性驗證:');
  let allMatch = true;
  for (const doc of testDocs) {
    const after = (await doc.ref.get()).data();
    const before = beforeData[doc.id];

    const priceMatch = after.price === before.price;
    const psa10Match = after.psa10 === before.psa10;
    const psaAllMatch = after.psa_all === before.psa_all;

    if (!priceMatch || !psa10Match || !psaAllMatch) allMatch = false;

    const status = (priceMatch && psa10Match && psaAllMatch) ? '✅' : '⚠️ ';
    console.log(`  ${status} ${doc.id} price=${after.price} psa10=${after.psa10} psa_all=${after.psa_all}`);
  }

  // RAM 峰值估算（Node.js RSS）
  const mem = process.memoryUsage();
  const ramMB = Math.round(mem.rss / 1024 / 1024);
  console.log(`\n📊 RAM: ${ramMB}MB RSS | heap=${Math.round(mem.heapUsed/1024/1024)}MB`);

  // 總結
  console.log('\n═══════════════════════════════════════════');
  console.log('  測試結果');
  console.log('═══════════════════════════════════════════');
  console.log(`  同步: ${result.written}/${testDocs.length} 張`);
  console.log(`  格式一致: ${allMatch ? '✅ YES' : '⚠️  有差異'} `);
  console.log(`  RAM: ${ramMB}MB (2.6GB limit)`);
  console.log(`  Status: ${result.written === testDocs.length && allMatch ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  process.exit(result.written === testDocs.length && allMatch ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });