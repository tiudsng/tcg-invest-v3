/**
 * Data Integrity Test for CardReader
 * Tests 3 scenarios:
 * 1. Static image URL (getSnkrdunkImageUrl formula)
 * 2. pokeca_gold read (document existence + field structure)
 * 3. pokeca-chart API (PSA + market data fetch)
 * 
 * Run: node --input-type=module < test_data_integrity.ts
 */

const PROJECT_ID = 'gen-lang-client-0326385388';
const DATABASE_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;

// Test IDs
const TEST_IDS = ['120746', '93060', '110080', '240193'];

function getSnkrdunkImageUrl(id) {
  return `https://static.snkrdunk.com/uploads/product_card_image/data/${id}/product_card_image_0_1600.jpg`;
}

async function testStaticImageUrl(id) {
  const url = getSnkrdunkImageUrl(id);
  console.log(`\n[TEST 1] Static Image URL for ID ${id}`);
  console.log(`  URL: ${url}`);
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    console.log(`  Status: ${resp.status} (${resp.ok ? 'OK' : 'FAIL'})`);
    return resp.ok;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return false;
  }
}

async function testFirestoreRead(id) {
  console.log(`\n[TEST 2] Firestore Read for ID ${id}`);
  const docPath = `pokeca_gold/${id}`;
  const url = `${BASE_URL}/documents/${docPath}`;
  
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    
    if (json.error) {
      console.log(`  ERROR: ${json.error.message}`);
      return { ok: false, error: json.error.message };
    }
    
    const fields = json.fields || {};
    console.log(`  Doc exists: ${!!json.name}`);
    console.log(`  Fields found: ${Object.keys(fields).join(', ')}`);
    
    // Check critical fields
    const hasNameJp = !!fields.name_jp;
    const hasSlug = !!fields.slug;
    const hasImageUrl = !!fields.image_url;
    const hasPsaData = !!fields.psa_data;
    const hasMarketData = !!fields.market_data;
    
    console.log(`  name_jp: ${hasNameJp ? '✓' : '✗'}`);
    console.log(`  slug: ${hasSlug ? '✓' : '✗'}`);
    console.log(`  image_url: ${hasImageUrl ? '✓' : '✗'}`);
    console.log(`  psa_data: ${hasPsaData ? '✓' : '✗'}`);
    console.log(`  market_data: ${hasMarketData ? '✓' : '✗'}`);
    
    if (hasNameJp) {
      console.log(`  name_jp value: "${fields.name_jp.stringValue}"`);
    }
    if (hasSlug) {
      console.log(`  slug value: "${fields.slug.stringValue}"`);
    }
    if (hasPsaData) {
      const psa = fields.psa_data.mapValue.fields;
      console.log(`  psa_data.psa10: ${psa.psa10?.integerValue ?? psa.psa10?.stringValue ?? 'MISSING'}`);
    }
    
    return { ok: true, fields };
  } catch (e) {
    console.log(`  Exception: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function testPokecaChartAPI(slug) {
  console.log(`\n[TEST 3] pokeca-chart API for slug: ${slug}`);
  
  try {
    // Step 1: Get item_id from slug
    const idUrl = `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`;
    console.log(`  Fetching item_id from: ${idUrl}`);
    
    const idResp = await fetch(idUrl);
    const itemIdText = await idResp.text();
    const itemId = parseInt(itemIdText.trim(), 10);
    
    console.log(`  item_id: ${itemId} (${isNaN(itemId) ? 'INVALID' : 'OK'})`);
    
    if (isNaN(itemId) || itemId === 0) {
      console.log(`  RESULT: No item_id found (slug may not exist on pokeca-chart)`);
      return { ok: false, reason: 'no_item_id' };
    }
    
    // Step 2: Get PSA population + market data
    const grdUrl = `https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=${itemId}`;
    console.log(`  Fetching PSA/market data from: ${grdUrl}`);
    
    const grdResp = await fetch(grdUrl);
    const grdData = await grdResp.json();
    
    if (!grdData || grdData.length === 0) {
      console.log(`  RESULT: No grade data returned`);
      return { ok: false, reason: 'no_grade_data' };
    }
    
    const info = grdData[0];
    console.log(`  psa10: ${info.grd_status_10 ?? 'MISSING'}`);
    console.log(`  psa_all: ${info.grd_status_all ?? 'MISSING'}`);
    console.log(`  psa10_pct: ${info.grd_status_pct ?? 'MISSING'}`);
    console.log(`  recent_price_0 (RAW): ${info.recent_price_0 ?? 'MISSING'}`);
    console.log(`  recent_price_2 (PSA10): ${info.recent_price_2 ?? 'MISSING'}`);
    console.log(`  RESULT: ✓ API working`);
    
    return { ok: true, data: info };
  } catch (e) {
    console.log(`  Exception: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════');
  console.log('  DATA INTEGRITY TEST - CardReader');
  console.log('═══════════════════════════════════════════');
  
  const results = { staticImage: {}, firestore: {}, pokecaApi: {} };
  
  for (const id of TEST_IDS) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(` TESTING CARD ID: ${id}`);
    console.log('═'.repeat(50));
    
    // Test 1: Static image URL
    results.staticImage[id] = await testStaticImageUrl(id);
    
    // Test 2: Firestore read
    results.firestore[id] = await testFirestoreRead(id);
    
    // Test 3: pokeca-chart API (only if slug exists)
    if (results.firestore[id].ok && results.firestore[id].fields?.slug) {
      const slug = results.firestore[id].fields.slug.stringValue;
      results.pokecaApi[id] = await testPokecaChartAPI(slug);
    } else {
      results.pokecaApi[id] = { ok: false, reason: 'no_slug' };
    }
  }
  
  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  
  console.log('\nStatic Image URLs:');
  for (const [id, result] of Object.entries(results.staticImage)) {
    console.log(`  ${id}: ${result ? '✓ PASS' : '✗ FAIL'}`);
  }
  
  console.log('\nFirestore Reads:');
  for (const [id, result] of Object.entries(results.firestore)) {
    const hasData = result.ok && result.fields;
    console.log(`  ${id}: ${hasData ? '✓ DOC FOUND' : '✗ ' + (result.error || result.reason)}`);
  }
  
  console.log('\npokeca-chart API:');
  for (const [id, result] of Object.entries(results.pokecaApi)) {
    console.log(`  ${id}: ${result.ok ? '✓ API OK' : '✗ ' + (result.reason || result.error)}`);
  }
  
  console.log('\n✅ Data Integrity Test Complete');
  console.log('Next: If all tests pass, we can build Cover Page');
}

runAllTests().catch(console.error);