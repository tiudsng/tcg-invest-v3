
const { Firestore } = require('@google-cloud/firestore');
const https = require('https');
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

async function main() {
  const snap = await db.collection('leaderboard').orderBy('rank', 'asc').limit(20).get();
  
  let updated = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (doc.id.startsWith('hermes_') || !d.card_number || !d.set_code) continue;
    
    const cardNum = d.card_number.split('/')[0].trim();
    const setCode = (d.set_code || '').toLowerCase();
    
    const slugs_to_try = [
      setCode + '-' + cardNum,
      setCode + '-jp-' + cardNum,
      setCode + '-en-' + cardNum,
      setCode.replace('-', '') + '-' + cardNum,
      cardNum + '-' + setCode
    ];
    
    let itemId = -1;
    let foundSlug = '';
    for (const slug of slugs_to_try) {
      const text = await get('https://pokeca-chart.com/ch/php/get-item-id.php?slug=' + encodeURIComponent(slug));
      const id = parseInt(text.trim().replace(/"/g, ''), 10);
      if (id > 0) { itemId = id; foundSlug = slug; break; }
      await new Promise(r => setTimeout(r, 200));
    }
    
    if (itemId <= 0) {
      console.log('[' + doc.id + '] FAIL slug=' + slugs_to_try[0] + ' (tried: ' + slugs_to_try.join(', ') + ')');
      continue;
    }
    
    const infoText = await get('https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=' + itemId);
    let info;
    try { info = JSON.parse(infoText)[0]; }
    catch(e) { console.log('[' + doc.id + '] grade info parse error'); continue; }
    
    const psa10Jpy = parseInt((info.recent_price_2 || '0').replace(/[^0-9]/g, ''), 10);
    const rawJpy = parseInt((info.recent_price_0 || '0').replace(/[^0-9]/g, ''), 10);
    const psa10Hkd = Math.round(psa10Jpy * 0.052);
    const rawHkd = Math.round(rawJpy * 0.052);
    
    console.log('[' + doc.id + '] ' + (d.name_zh || d.name_jp || '?') + ' -> item_id=' + itemId + ' slug=' + foundSlug);
    console.log('   PSA10: ' + info.recent_price_2 + ' = HK$' + psa10Hkd.toLocaleString());
    console.log('   RAW: ' + info.recent_price_0 + ' = HK$' + rawHkd.toLocaleString());
    console.log('   pop: ' + info.grd_status_10 + '/' + info.grd_status_all + ' (' + info.grd_status_pct + '%)');
    
    await doc.ref.update({
      'market_data.psa10_price': psa10Hkd,
      'market_data.raw_price': rawHkd,
      'market_data.last_psa10_jpy': psa10Jpy,
      'market_data.last_raw_jpy': rawJpy,
      'market_data.psa_pop_10': info.grd_status_10,
      'market_data.psa_pop_total': info.grd_status_all,
      'market_data.psa_pop_10_percent': info.grd_status_pct + '%',
      'market_data.updatedAt': new Date().toISOString()
    });
    
    console.log('   -> Updated!');
    updated++;
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\nDone: ' + updated + ' updated');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
