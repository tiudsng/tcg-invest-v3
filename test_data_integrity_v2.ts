/**
 * Data Integrity Test v2 - Using Environment Variables
 * Tests what we can from this environment
 */

const PROJECT_ID = 'gen-lang-client-0326385388';
const DATABASE_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/`;

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
  const token = jwt.sign(
    { 
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    },
    privateKey,
    { algorithm: 'RS256', header: { typ: 'JWT', alg: 'RS256' } }
  );
  
  // Exchange for access token
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    })
  });
  
  const json = await resp.json();
  return json.access_token;
}

async function testFirestoreWithAuth(id, accessToken) {
  console.log(`\n[TEST] Firestore Read + pokeca-chart API for ID: ${id}`);
  
  // Test 1: Firestore read
  const docPath = `pokeca_gold/${id}`;
  const url = `${BASE_URL}/documents/${docPath}`;
  
  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const json = await resp.json();
    
    if (json.error) {
      console.log(`  Firestore: ✗ ${json.error.message}`);
    } else {
      const fields = json.fields || {};
      console.log(`  Firestore: ✓ Doc found`);
      console.log(`    name_jp: ${fields.name_jp?.stringValue ?? 'MISSING'}`);
      console.log(`    slug: ${fields.slug?.stringValue ?? 'MISSING'}`);
      console.log(`    psa_data: ${fields.psa_data ? '✓' : '✗'}`);
      console.log(`    market_data: ${fields.market_data ? '✓' : '✗'}`);
      
      // If slug exists, test pokeca-chart API
      if (fields.slug?.stringValue) {
        await testPokecaChartAPI(fields.slug.stringValue);
      }
    }
  } catch (e) {
    console.log(`  Firestore Exception: ${e.message}`);
  }
}

async function testPokecaChartAPI(slug) {
  console.log(`\n  pokeca-chart API:`);
  
  try {
    const idUrl = `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`;
    const idResp = await fetch(idUrl);
    const itemIdText = await idResp.text();
    const itemId = parseInt(itemIdText.trim(), 10);
    
    if (isNaN(itemId) || itemId === 0 || itemId === -1) {
      console.log(`    item_id: ${itemId} (invalid - slug may not exist)`);
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
    console.log(`    RAW price: ${info.recent_price_0 ?? '?'} | PSA10 price: ${info.recent_price_2 ?? '?'}`);
    console.log(`    pokeca-chart API: ✓`);
  } catch (e) {
    console.log(`    Exception: ${e.message}`);
  }
}

async function testStaticImage() {
  console.log(`\n[TEST] Static Image URL (SNKRDUNK CDN)`);
  
  for (const id of TEST_IDS.slice(0, 2)) {
    const url = getSnkrdunkImageUrl(id);
    try {
      const resp = await fetch(url, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`  ${id}: HTTP ${resp.status} (${url.slice(0, 60)}...)`);
    } catch (e) {
      console.log(`  ${id}: FAIL - ${e.message.slice(0, 50)}`);
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  DATA INTEGRITY TEST v2');
  console.log('═══════════════════════════════════════════');
  
  // Test static images (no auth needed)
  await testStaticImage();
  
  // Try to get Firebase access token
  try {
    console.log('\n[TEST] Firebase Authentication...');
    const accessToken = await getAccessToken();
    console.log(`  Access token: ${accessToken ? '✓ obtained (len=' + accessToken.length + ')' : '✗ failed'}`);
    
    if (accessToken) {
      for (const id of TEST_IDS) {
        await testFirestoreWithAuth(id, accessToken);
      }
    }
  } catch (e) {
    console.log(`\n  Firebase auth failed: ${e.message}`);
    console.log('  Skipping Firestore read tests');
  }
  
  console.log('\n✅ Test complete');
}

main().catch(console.error);