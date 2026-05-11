
const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

const db = new Firestore({
  credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

function getItemId(slug) {
  return new Promise((resolve, reject) => {
    const url = 'https://pokeca-chart.com/ch/php/get-item-id.php?slug=' + encodeURIComponent(slug);
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

function getGradeInfo(itemId) {
  return new Promise((resolve, reject) => {
    const url = 'https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=' + itemId;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)[0]); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

function slugFromCard(setCode, cardNumber) {
  if (!setCode || !cardNumber) return null;
  
  const setLower = setCode.toLowerCase();
  const cardNum = cardNumber.split('/')[0].trim();
  
  const numStr = parseInt(cardNum, 10).toString();
  
  if (setLower === 'svp' || setLower === 'svp-en' || setLower === 'svp-jp') {
    return 'svp-en-' + numStr;
  }
  if (setLower === 'sm-p' || setLower === 'smp') {
    return 'sm-p-' + numStr;
  }
  
  return setLower + '-' + numStr;
}

async function main() {
  const snap = await db.collection('leaderboard').orderBy('rank', 'asc').limit(10).get();
  
  let updated = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (doc.id.startsWith('hermes_') || !d.card_number) {
      console.log('[SKIP] ' + doc.id);
      continue;
    }
    
    const slug = slugFromCard(d.set_code, d.card_number);
    console.log('\n[' + doc.id + '] ' + (d.name_zh || d.name_jp || '?'));
    console.log('  set=' + d.set_code + ' card=' + d.card_number + ' -> slug=' + slug);
    
    const current = d.market_data;
    console.log('  current: psa10=' + (current && current.psa10_price) + ' raw=' + (current && current.raw_price));
    
    if (!slug) {
      console.log('  (no slug)');
      continue;
    }
    
    const itemIdText = await getItemId(slug);
    const itemId = parseInt(itemIdText, 10);
    
    if (itemId <= 0) {
      console.log('  item_id: ' + itemIdText + ' (not found for slug: ' + slug + ')');
      
      const cardNum = d.card_number.split('/')[0].trim();
      const altSlug = 'svp-en-' + cardNum;
      const altIdText = await getItemId(altSlug);
      const altId = parseInt(altIdText, 10);
      if (altId > 0) {
        console.log('  alt slug ' + altSlug + ' -> item_id=' + altId);
        const info = await getGradeInfo(altId);
        if (info) {
          const psa10Jpy = parseInt(info.recent_price_2.replace(/[^0-9]/g, ''), 10);
          const rawJpy = parseInt(info.recent_price_0.replace(/[^0-9]/g, ''), 10);
          console.log('  NEW: psa10=' + info.recent_price_2 + ' raw=' + info.recent_price_0);
          
          await doc.ref.update({
            'market_data.psa10_price': Math.round(psa10Jpy * 0.052),
            'market_data.raw_price': Math.round(rawJpy * 0.052),
            'market_data.last_psa10_jpy': psa10Jpy,
            'market_data.last_raw_jpy': rawJpy,
            'market_data.psa_pop_10': info.grd_status_10,
            'market_data.psa_pop_total': info.grd_status_all,
            'market_data.psa_pop_10_percent': info.grd_status_pct + '%',
            'market_data.updatedAt': new Date().toISOString()
          });
          console.log('  -> Updated!');
          updated++;
        }
      }
    } else {
      const info = await getGradeInfo(itemId);
      if (info) {
        const psa10Jpy = parseInt(info.recent_price_2.replace(/[^0-9]/g, ''), 10);
        const rawJpy = parseInt(info.recent_price_0.replace(/[^0-9]/g, ''), 10);
        const psa10Hkd = Math.round(psa10Jpy * 0.052);
        const rawHkd = Math.round(rawJpy * 0.052);
        console.log('  item_id: ' + itemId + ' -> psa10=' + info.recent_price_2 + ' (' + psa10Hkd + ') raw=' + info.recent_price_0 + ' (' + rawHkd + ')');
        
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
        console.log('  -> Updated!');
        updated++;
      }
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\nDone! Updated ' + updated + ' cards');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
