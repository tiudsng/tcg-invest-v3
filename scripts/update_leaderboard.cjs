
const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

// ── Percent sanitizer ─────────────────────────────────────────────────────────
function sanitizePct(val) {
  if (val === undefined || val === null) return '0%';
  const s = String(val);
  if (s === 'undefined' || s === 'null' || s === '') return '0%';
  const clean = s.replace(/%+/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? '0%' : `${num}%`;
}

const db = new Firestore({
  credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

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
  const text = await get('https://pokeca-chart.com/ch/php/get-item-id.php?slug=' + encodeURIComponent(slug));
  return parseInt(text.trim().replace(/"/g, ''), 10);
}

async function getGradeInfo(itemId) {
  const text = await get('https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=' + itemId);
  try { return JSON.parse(text)[0]; }
  catch(e) { return null; }
}

function buildSlugs(setCode, cardNumber) {
  const num = cardNumber ? cardNumber.split('/')[0].trim() : '';
  const n = num ? String(parseInt(num, 10)) : '';
  const sc = (setCode || '').toLowerCase();
  
  if (sc === 'svp') return ['svp-en-' + n, 'svp-jp-' + n];
  if (sc === 'sm-p' || sc === 'smp') return ['sm-p-' + n, 'sm-p' + n];
  return [sc + '-' + n];
}

async function updateLeaderboard() {
  const snap = await db.collection('leaderboard').orderBy('rank', 'asc').limit(15).get();
  
  let updated = 0, failed = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (doc.id.startsWith('hermes_') || doc.id.startsWith('test_')) {
      console.log('[SKIP] ' + doc.id);
      continue;
    }
    if (!d.card_number || !d.set_code) {
      console.log('[SKIP] ' + doc.id + ' (no card_number/set_code)');
      continue;
    }
    
    const name = d.name_zh || d.name_jp || d.name_en || doc.id;
    const slugs = buildSlugs(d.set_code, d.card_number);
    
    console.log('\n[' + doc.id + '] ' + name + ' set=' + d.set_code + ' card=' + d.card_number);
    console.log('  Slugs to try: ' + slugs.join(', '));
    
    let itemId = -1;
    for (const slug of slugs) {
      const id = await getItemId(slug);
      if (id > 0) { itemId = id; console.log('  slug "' + slug + '" -> item_id=' + id); break; }
    }
    
    if (itemId <= 0) {
      console.log('  FAILED: no valid item_id found for any slug');
      failed++;
      continue;
    }
    
    const info = await getGradeInfo(itemId);
    if (!info) {
      console.log('  FAILED: no grade info for item_id=' + itemId);
      failed++;
      continue;
    }
    
    const psa10Jpy = parseInt((info.recent_price_2 || '0').replace(/[^0-9]/g, ''), 10);
    const rawJpy = parseInt((info.recent_price_0 || '0').replace(/[^0-9]/g, ''), 10);
    const psa10Hkd = Math.round(psa10Jpy * 0.052);
    const rawHkd = Math.round(rawJpy * 0.052);
    
    console.log('  PSA10: ' + info.recent_price_2 + ' = HK$' + psa10Hkd.toLocaleString() + ' (JPY ' + psa10Jpy.toLocaleString() + ')');
    console.log('  RAW: ' + info.recent_price_0 + ' = HK$' + rawHkd.toLocaleString() + ' (JPY ' + rawJpy.toLocaleString() + ')');
    console.log('  PSA10 pop: ' + info.grd_status_10 + '/' + info.grd_status_all + ' (' + info.grd_status_pct + '%)');
    
    await doc.ref.update({
      'market_data.psa10_price': psa10Hkd,
      'market_data.raw_price': rawHkd,
      'market_data.last_psa10_jpy': psa10Jpy,
      'market_data.last_raw_jpy': rawJpy,
      'market_data.psa_pop_10': info.grd_status_10,
      'market_data.psa_pop_total': info.grd_status_all,
      'market_data.psa_pop_10_percent': sanitizePct(info.grd_status_pct),
      'market_data.updatedAt': new Date().toISOString(),
      'market_data.sync_source': 'pokeca_chart_api'
    });
    
    console.log('  -> Updated!');
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n=== Summary: ' + updated + ' updated, ' + failed + ' failed ===');
  process.exit(0);
}

updateLeaderboard().catch(e => { console.error(e); process.exit(1); });
