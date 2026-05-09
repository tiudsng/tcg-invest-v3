/**
 * Data Integrity Test v3 - Using Service Account from env
 * Service account found in FIREBASE_PRIVATE_KEY env var
 */

const PROJECT_ID = 'gen-lang-client-0326385388';
const DATABASE_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;

const TEST_IDS = ['120746', '93060', '110080', '240193'];

function getSnkrdunkImageUrl(id) {
  return `https://static.snkrdunk.com/uploads/product_card_image/data/${id}/product_card_image_0_1600.jpg`;
}

async function getAccessToken() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!privateKey || !clientEmail) {
    throw new Error('Missing FIREBASE_PRIVATE_KEY or FIREBASE_CLIENT_EMAIL env vars');
  }
  
  const jwt = require('jsonwebtoken');
  const now = Math.floor(Date.now() / 1000);
  
  const token = jwt.sign(
    {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    },
    privateKey,
    { algorithm: 'RS256' }
  );
  
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    })
  });
  
  const json = await resp.json();
  if (json.error) throw new Error(json.error_description || json.error);
  return json.access_token;
}

async function testFirestoreRead(id, accessToken) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ID: ${id}`);
  console.log('─'.repeat(50));
  
  const url = `${BASE_URL}/documents/pokeca_gold/${id}`;
  
  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const json = await resp.json();
    
    if (json.error) {
      console.log(`  Firestore: ✗ ${json.error.message}`);
      return { ok: false, error: json.error.message };
    }
    
    const fields = json.fields || {};
    console.log(`  Firestore: ✓ Doc exists`);
    console.log(`    name_jp: ${fields.name_jp?.stringValue ?? '✗ MISSING'}`);
    console.log(`    slug: ${fields.slug?.stringValue ?? '✗ MISSING'}`);
    console.log(`    image_url: ${fields.image_url?.stringValue ? '✓' : '✗ MISSING'}`);
    console.log(`    psa_data: ${fields.psa_data ? '✓' : '✗ MISSING'}`);
    console.log(`    market_data: ${fields.market_data ? '✓' : '✗ MISSING'}`);
    
    return { ok: true, fields, slug: fields.slug?.stringValue };
  } catch (e) {
    console.log(`  Firestore: ✗ Exception: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function testPokecaChartAPI(slug) {
  if (!slug) return;
  
  console.log(`  pokeca-chart API:`);
  
  try {
    const idUrl = `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`;
    const idResp = await fetch(idUrl);
    const itemIdText = await idResp.text();
    const itemId = parseInt(itemIdText.trim(), 10);
    
    if (isNaN(itemId) || itemId <= 0) {
      console.log(`    item_id: "${itemIdText.trim()}" (invalid)`);
      return;
    }
    
    console.log(`    item_id: ${itemId} ✓`);
    
    const grdUrl = `https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=${itemId}`;
    const grdResp = await fetch(grdUrl);
    const grdData = await grdResp.json();
    
    if (!grdData || grdData.length === 0) {
      console.log(`    grade_data: EMPTY`);
      return;
    }
    
    const info = grdData[0];
    console.log(`    psa10: ${info.grd_status_10 ?? '?'} | psa_all: ${info.grd_status_all ?? '?'}`);
    console.log(`    psa10_pct: ${info.grd_status_pct ?? '?'}%`);
    console.log(`    RAW price: ${info.recent_price_0 ?? '?'}`);
    console.log(`    PSA10 price: ${info.recent_price_2 ?? '?'}`);
    console.log(`    Result: ✓ API working`);
  } catch (e) {
    console.log(`    Exception: ${e.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  DATA INTEGRITY TEST v3');
  console.log('═══════════════════════════════════════════');
  
  let accessToken;
  try {
    console.log('[1] Getting Firebase access token...');
    accessToken = await getAccessToken();
    console.log(`    ✓ Token obtained (len=${accessToken.length})`);
  } catch (e) {
    console.log(`    ✗ Auth failed: ${e.message}`);
    return;
  }
  
  const results = {};
  
  for (const id of TEST_IDS) {
    const r = await testFirestoreRead(id, accessToken);
    results[id] = r;
    
    if (r.ok && r.slug) {
      await testPokecaChartAPI(r.slug);
    }
  }
  
  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  
  const pass = Object.values(results).filter(r => r.ok).length;
  console.log(`  Firestore: ${pass}/${TEST_IDS.length} docs found`);
  
  const withSlug = Object.values(results).filter(r => r.ok && r.slug).length;
  console.log(`  Slugs found: ${withSlug}`);
  
  console.log('\n  Next step: If Firestore reads work, we need to:');
  console.log('  1. Deploy firestore.rules (add pokeca_gold read rule)');
  console.log('  2. Fix SNKRDUNK image URLs (blocked from this server)');
  console.log('  3. Build Cover Page with CardReader.getCards()');
}

main().catch(console.error);