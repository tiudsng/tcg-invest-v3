
const { Firestore } = require('@google-cloud/firestore');
const https = require('https');

const db = new Firestore({
  credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

async function getItemId(slug) {
  return new Promise((resolve, reject) => {
    const url = `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', reject);
  });
}

async function getGradeInfo(itemId) {
  return new Promise((resolve, reject) => {
    const url = `https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=${itemId}`;
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

async function main() {
  // Get leaderboard top 5
  const snap = await db.collection('leaderboard').orderBy('rank', 'asc').limit(5).get();
  
  for (const doc of snap.docs) {
    const d = doc.data();
    const cardNum = d.card_number || '';
    const setCode = d.set_code || '';
    const slug = `${setCode}-${cardNum}`.replace(/\//g, '-').toLowerCase();
    
    console.log(`\n[${doc.id}] ${d.name_zh || d.name_jp || '?'}`);
    console.log(`  slug: ${slug}`);
    console.log(`  current psa10_price: ${d.market_data?.psa10_price}`);
    console.log(`  current raw_price: ${d.market_data?.raw_price}`);
    
    const itemIdText = await getItemId(slug);
    const itemId = parseInt(itemIdText, 10);
    
    if (itemId > 0) {
      const info = await getGradeInfo(itemId);
      if (info) {
        const psa10Jpy = parseInt(info.recent_price_2.replace(/[^0-9]/g, ''), 10);
        const rawJpy = parseInt(info.recent_price_0.replace(/[^0-9]/g, ''), 10);
        const psa10Hkd = Math.round(psa10Jpy * 0.052);
        const rawHkd = Math.round(rawJpy * 0.052);
        console.log(`  item_id: ${itemId}`);
        console.log(`  psa10: ${info.grd_status_10} (${info.grd_status_pct}%)`);
        console.log(`  PSA10 price: ${info.recent_price_2} = HK$${psa10Hkd.toLocaleString()}`);
        console.log(`  RAW price: ${info.recent_price_0} = HK$${rawHkd.toLocaleString()}`);
        
        // Update Firestore
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
        console.log(`  -> Updated!`);
      }
    } else {
      console.log(`  item_id: "${itemIdText}" (invalid slug)`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
