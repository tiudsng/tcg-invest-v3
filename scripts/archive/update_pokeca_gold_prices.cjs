/**
 * update_pokeca_gold_prices.cjs
 * 
 * 目的：更新成個 pokeca_gold collection 的市場價格數據
 * 數據源：pokeca-chart.com API
 * 寫入目標：pokeca_gold collection (同一個 collection)
 * 
 * 流程：
 *   pokeca_gold doc → slug → get-item-id.php → item_id
 *   → get_item_grd_info → price/population data
 *   → 更新同一個 doc
 */

const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

const db = new Firestore({
  credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

const JPY_TO_HKD = 0.052;
const POKECA_API_BASE = 'https://pokeca-chart.com/ch/php';
const BATCH_SIZE = 30;       // concurrent API calls
const WRITE_BATCH = 50;      // Firestore batch write size
const RATE_LIMIT_DELAY = 100; // ms between batches

// ─── API helpers ─────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function getItemId(slug) {
  try {
    const text = await get(`${POKECA_API_BASE}/get-item-id.php?slug=${encodeURIComponent(slug)}`);
    const id = parseInt(text.trim().replace(/"/g, ''), 10);
    return isNaN(id) ? -1 : id;
  } catch { return -1; }
}

async function getGradeInfo(itemId) {
  try {
    const text = await get(`${POKECA_API_BASE}/get.php?function=get_item_grd_info&item_id=${itemId}`);
    const arr = JSON.parse(text);
    return arr[0] || null;
  } catch { return null; }
}

// ─── Price parser ─────────────────────────────────────────────────────────────

function parsePrice(str) {
  if (!str || str === '-' || str === '') return 0;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

// ─── Batched concurrency ─────────────────────────────────────────────────────

async function batchProcess(items, concurrency, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📡 Loading pokeca_gold collection...');
  const goldSnap = await db.collection('pokeca_gold').get();
  console.log(`   Total docs: ${goldSnap.docs.length}`);

  const docs = goldSnap.docs.filter(d => {
    const data = d.data();
    return data.slug && data.slug.trim() !== '';
  });

  console.log(`   Docs with slug: ${docs.length}`);
  console.log(`   Concurrent API calls: ${BATCH_SIZE}`);
  console.log('');

  // ── Phase 1: Fetch item_ids ────────────────────────────────────────────────

  console.log('🔍 Phase 1: Resolving slugs → item_ids...');
  let itemIdMap = {}; // docId → itemId

  await batchProcess(docs, BATCH_SIZE, async (docSnap) => {
    const slug = docSnap.data().slug;
    const itemId = await getItemId(slug);
    itemIdMap[docSnap.id] = { itemId, slug };
    if (itemId > 0) {
      process.stdout.write('✓');
    } else {
      process.stdout.write('✗');
    }
  });

  const found = Object.values(itemIdMap).filter(x => x.itemId > 0).length;
  const missing = docs.length - found;
  console.log(`\n   Found: ${found}/${docs.length} | Missing: ${missing}`);

  // ── Phase 2: Fetch grade info ──────────────────────────────────────────────

  const docsWithId = docs.filter(d => itemIdMap[d.id]?.itemId > 0);
  console.log('\n💰 Phase 2: Fetching price data from pokeca-chart...');

  let priceMap = {}; // docId → gradeInfo

  await batchProcess(docsWithId, BATCH_SIZE, async (docSnap) => {
    const itemId = itemIdMap[docSnap.id].itemId;
    const info = await getGradeInfo(itemId);
    priceMap[docSnap.id] = info;
    if (info) {
      process.stdout.write('✓');
    } else {
      process.stdout.write('✗');
    }
  });

  const gotPrice = Object.values(priceMap).filter(x => x !== null).length;
  console.log(`\n   Price data: ${gotPrice}/${docsWithId.length}`);

  // ── Phase 3: Write to Firestore (batched) ──────────────────────────────────

  console.log('\n💾 Phase 3: Writing to Firestore (batched ${WRITE_BATCH})...');
  const docsToUpdate = docs.filter(d => priceMap[d.id] !== null);
  let written = 0;

  for (let i = 0; i < docsToUpdate.length; i += WRITE_BATCH) {
    const batch = docsToUpdate.slice(i, i + WRITE_BATCH);
    const wb = db.batch();

    batch.forEach(docSnap => {
      const info = priceMap[docSnap.id];
      if (!info) return;

      const psa10Jpy = parsePrice(info.recent_price_2);
      const rawJpy = parsePrice(info.recent_price_0);
      const psa10Hkd = Math.round(psa10Jpy * JPY_TO_HKD);
      const rawHkd = Math.round(rawJpy * JPY_TO_HKD);
      const pop10Str = String(info.grd_status_10 || '0');
      const popAllStr = String(info.grd_status_all || '0');
      const pop10 = parseInt(pop10Str.replace(/[^0-9]/g, ''), 10);
      const popAll = parseInt(popAllStr.replace(/[^0-9]/g, ''), 10);
      const pct = popAll > 0 ? ((pop10 / popAll) * 100).toFixed(1) + '%' : '0%';
      const ratio = rawHkd > 0 ? (psa10Hkd / rawHkd).toFixed(2) : '0';

      const updates = {
        // Top-level price fields
        price: psa10Hkd,                          // PSA10 in HKD (primary display price)
        psa_all: popAll,
        psa10: pop10,
        psa10_pct: pct,
        psa10_raw_ratio: parseFloat(ratio),
        updatedAt: new Date().toISOString(),
        // market_data sub-object
        market_data: {
          psa10_price: psa10Hkd,
          raw_price: rawHkd,
          psa10_latest_jpy: psa10Jpy,
          raw_latest_jpy: rawJpy,
          psa_pop_10: pop10,
          psa_pop_total: popAll,
          psa_pop_10_percent: pct,
          source: 'pokeca-chart',
          updatedAt: new Date().toISOString()
        }
      };

      wb.update(docSnap.ref, updates);
    });

    await wb.commit();
    written += batch.length;
    process.stdout.write(`█`);
  }

  console.log('\n');
  console.log('══════════════════════════════════════════');
  console.log('✅ DONE — pokeca_gold price sync complete');
  console.log('══════════════════════════════════════════');
  console.log(`   Total docs:   ${goldSnap.docs.length}`);
  console.log(`   With slug:    ${docs.length}`);
  console.log(`   item_id found: ${found}`);
  console.log(`   Price fetched: ${gotPrice}`);
  console.log(`   Written:      ${written}`);
  console.log(`   JPY→HKD rate: ${JPY_TO_HKD}`);
  console.log('');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });