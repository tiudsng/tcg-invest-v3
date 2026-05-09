/**
 * Deep analysis: Check if set_code + card_number can derive pokeca-chart slug
 * 
 * pokeca-chart slug format: {set_code}-{card_number}
 * e.g. "sv2d-93" from set_code="sv2d" + card_number="93"
 * 
 * This script verifies this hypothesis and counts how many of the 102
 * incomplete docs can be fixed this way.
 */

import jwt from 'jsonwebtoken';

const PROJECT_ID = 'gen-lang-client-0326385388';
const DATABASE_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';

async function getAccessToken() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: clientEmail, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    privateKey,
    { algorithm: 'RS256' }
  );
  
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: token })
  });
  
  const json = await resp.json();
  if (json.error) throw new Error(json.error_description || json.error);
  return json.access_token;
}

async function testPokecaChartSlug(slug) {
  try {
    const idUrl = `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`;
    const resp = await fetch(idUrl);
    const text = await resp.text();
    const itemId = parseInt(text.trim(), 10);
    return { slug, itemId, valid: itemId > 0 };
  } catch (e) {
    return { slug, itemId: -1, valid: false, error: e.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  SLUG DERIVATION + POKECA-CHART VERIFY');
  console.log('═══════════════════════════════════════════\n');
  
  const accessToken = await getAccessToken();
  
  // First: verify the slug derivation hypothesis with known good docs
  console.log('[PHASE 1] Verify slug derivation on COMPLETE docs (have slug)\n');
  
  const completeIds = ['93060', '110080', '240193'];
  
  for (const id of completeIds) {
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/pokeca_gold/${id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const json = await r.json();
    const f = json.fields || {};
    
    const actualSlug = f.slug?.stringValue;
    const setCode = f.set_code?.stringValue;
    const cardNum = f.card_number?.stringValue;
    
    // Derive slug from set_code + card_number
    const derivedSlug = `${setCode}-${cardNum}`.toLowerCase().replace(/\s+/g, '');
    
    console.log(`  ${id}: set="${setCode}" num="${cardNum}" → derived="${derivedSlug}" vs actual="${actualSlug}"`);
    console.log(`    Match: ${derivedSlug === actualSlug ? '✓ YES' : '✗ NO'}`);
  }
  
  console.log('\n[PHASE 2] Check 102 incomplete docs - can we derive slugs?\n');
  
  // Fetch ALL docs with pagination
  let allDocs = [];
  let pageToken = '';
  
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/pokeca_gold?pageSize=500`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const json = await resp.json();
    
    if (json.documents) allDocs.push(...json.documents);
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  
  const incompleteDocs = allDocs.filter(d => {
    const f = d.fields || {};
    return !f.slug?.stringValue;
  });
  
  console.log(`  Incomplete docs: ${incompleteDocs.length}`);
  
  // Try to derive slug for each
  const derivable = [];
  const notDerivable = [];
  
  for (const doc of incompleteDocs) {
    const f = doc.fields || {};
    const docId = doc.name.split('/').pop();
    const setCode = f.set_code?.stringValue || '';
    const cardNum = f.card_number?.stringValue || '';
    const name = f.name_jp?.stringValue || '';
    
    // Check if we have both set_code and card_number
    if (setCode && cardNum) {
      const derived = `${setCode}-${cardNum}`.toLowerCase();
      derivable.push({ docId, name, derived, setCode, cardNum });
    } else {
      notDerivable.push({ docId, name, setCode, cardNum });
    }
  }
  
  console.log(`  Can derive slug: ${derivable.length}`);
  console.log(`  Cannot derive: ${notDerivable.length}`);
  
  if (derivable.length > 0) {
    console.log('\n  First 10 derivable:');
    derivable.slice(0, 10).forEach(d => {
      console.log(`    ${d.docId}: "${d.name}" → slug="${d.derived}"`);
    });
  }
  
  if (notDerivable.length > 0) {
    console.log('\n  Cannot derive (missing set_code or card_number):');
    notDerivable.slice(0, 5).forEach(d => {
      console.log(`    ${d.docId}: "${d.name}" [set="${d.setCode}" num="${d.cardNum}"]`);
    });
  }
  
  console.log('\n[PHASE 3] Verify derived slugs with pokeca-chart API (first 5)\n');
  
  for (const d of derivable.slice(0, 5)) {
    const result = await testPokecaChartSlug(d.derived);
    console.log(`  ${d.docId}: "${d.derived}" → item_id=${result.itemId} (${result.valid ? '✓' : '✗'})`);
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════════');
  console.log('  RECOMMENDATION');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('  Option A: Backfill slugs by deriving from set_code-card_number');
  console.log(`             ${derivable.length} docs can be fixed immediately`);
  console.log('');
  console.log('  Option B: Fix CardReader to use derived slug when native slug missing');
  console.log('             0 code changes, just backfill the ${derivable.length} slugs');
  console.log('');
  console.log('  Both: We also need pokeca_gold read permission for browser client');
  console.log('        (Currently only authenticated users can read)');
}

main().catch(console.error);