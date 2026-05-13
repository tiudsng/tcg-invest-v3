
const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

// ── Percent sanitizer ─────────────────────────────────────────────────────────
// Prevents '85.3%%' double-percent bug when API returns '85.3%' (already has %)
// Also catches 'undefined%' literal strings from broken scrapers
function sanitizePct(val) {
  if (val === undefined || val === null) return '0%';
  const s = String(val);
  if (s === 'undefined' || s === 'null' || s === '') return '0%';
  // Strip any existing % then re-add exactly one
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

async function main() {
  const [lbSnap, goldSnap] = await Promise.all([
    db.collection('leaderboard').orderBy('rank', 'asc').limit(30).get(),
    db.collection('pokeca_gold').get()
  ]);
  
  const goldBySlug = {};
  goldSnap.docs.forEach(d => {
    const data = d.data();
    if (data.slug) goldBySlug[data.slug] = d;
  });
  
  const goldByKey = {};
  goldSnap.docs.forEach(d => {
    const data = d.data();
    const num = (data.card_number || '').split('/')[0].trim();
    const key = (data.set_code || '').toLowerCase() + '-' + num;
    goldByKey[key] = d;
  });
  
  console.log('Loaded ' + goldSnap.docs.length + ' pokeca_gold docs, keys: ' + Object.keys(goldByKey).length);
  
  let updated = 0;
  for (const doc of lbSnap.docs) {
    const d = doc.data();
    if (doc.id.startsWith('hermes_') || !d.card_number || !d.set_code) continue;
    
    const cardNum = d.card_number.split('/')[0].trim();
    const setCode = (d.set_code || '').toLowerCase();
    const key = setCode + '-' + cardNum;
    
    const name = d.name_zh || d.name_jp || '?';
    
    let goldDoc = goldByKey[key];
    if (!goldDoc) {
      goldDoc = goldBySlug[setCode + '-' + cardNum];
    }
    
    if (!goldDoc) {
      const jpSlug = (d.name_jp || '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
      goldDoc = goldBySlug[jpSlug];
    }
    
    if (!goldDoc) {
      console.log('[SKIP] ' + doc.id + ' ' + name + ' key=' + key + ' - no gold doc');
      continue;
    }
    
    const goldSlug = goldDoc.data().slug;
    console.log('[' + doc.id + '] ' + name + ' gold_slug=' + goldSlug + ' -> ', { ended: false });
    
    if (!goldSlug) {
      console.log('no slug');
      continue;
    }
    
    const itemId = await getItemId(goldSlug);
    if (itemId <= 0) {
      console.log('item_id not found');
      continue;
    }
    
    const info = await getGradeInfo(itemId);
    if (!info) { console.log('no grade info'); continue; }
    
    const psa10Jpy = parseInt((info.recent_price_2 || '0').replace(/[^0-9]/g, ''), 10);
    const rawJpy = parseInt((info.recent_price_0 || '0').replace(/[^0-9]/g, ''), 10);
    const psa10Hkd = Math.round(psa10Jpy * 0.052);
    const rawHkd = Math.round(rawJpy * 0.052);
    
    console.log('PSA10=' + info.recent_price_2 + '=HK$' + psa10Hkd.toLocaleString() + ' RAW=' + info.recent_price_0 + '=HK$' + rawHkd.toLocaleString());
    
    await doc.ref.update({
      'market_data.psa10_price': psa10Hkd,
      'market_data.raw_price': rawHkd,
      'market_data.last_psa10_jpy': psa10Jpy,
      'market_data.last_raw_jpy': rawJpy,
      'market_data.psa_pop_10': info.grd_status_10,
      'market_data.psa_pop_total': info.grd_status_all,
      'market_data.psa_pop_10_percent': sanitizePct(info.grd_status_pct),
      'market_data.updatedAt': new Date().toISOString()
    });
    
    console.log('-> Updated!');
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\nDone: ' + updated + ' updated');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
