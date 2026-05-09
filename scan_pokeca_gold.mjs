/**
 * Scan pokeca_gold collection - count docs by data completeness
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

async function queryCollection(accessToken, orderBy = '') {
  const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
  let url = `${DB}/documents/pokeca_gold?pageSize=500`;
  if (orderBy) url += `&orderBy=${encodeURIComponent(orderBy)}`;
  
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return resp.json();
}

function classifyDoc(doc) {
  const fields = doc.fields || {};
  const hasSlug = !!(fields.slug?.stringValue);
  const hasMarketData = !!(fields.market_data?.mapValue);
  const hasPsaData = !!(fields.psa_data?.mapValue || fields.psa10?.integerValue);
  const hasImgUrl = !!(fields.img_url?.stringValue || fields.image_url?.stringValue);
  
  return { hasSlug, hasMarketData, hasPsaData, hasImgUrl };
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  POKECA_GOLD COLLECTION SURVEY');
  console.log('═══════════════════════════════════════════\n');
  
  const accessToken = await getAccessToken();
  
  let allDocs = [];
  let pageToken = '';
  
  do {
    process.stdout.write(`  Fetching docs... ${allDocs.length} collected\r`);
    
    let url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/pokeca_gold?pageSize=500`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const json = await resp.json();
    
    if (json.documents) {
      allDocs.push(...json.documents);
    }
    
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  
  console.log(`  Total docs: ${allDocs.length}\n`);
  
  // Classify each doc
  const stats = {
    complete: 0,      // has slug + market_data + img_url
    hasSlugNoData: 0,  // has slug but no market_data
    noSlug: 0,         // no slug
    noData: 0          // almost empty
  };
  
  const noSlugDocs = [];
  
  allDocs.forEach(doc => {
    const c = classifyDoc(doc);
    const docId = doc.name.split('/').pop();
    
    if (!c.hasSlug) {
      stats.noSlug++;
      noSlugDocs.push({ docId, name: doc.fields?.name_jp?.stringValue || '', set: doc.fields?.set_code?.stringValue || '' });
    } else if (!c.hasMarketData) {
      stats.hasSlugNoData++;
    } else {
      stats.complete++;
    }
  });
  
  console.log('  Data Completeness:');
  console.log(`    Complete (slug + market_data): ${stats.complete}`);
  console.log(`    Has slug, no market_data: ${stats.hasSlugNoData}`);
  console.log(`    Missing slug: ${stats.noSlug}`);
  console.log(`    Total: ${allDocs.length}\n`);
  
  if (noSlugDocs.length > 0) {
    console.log(`  Missing slug docs (${noSlugDocs.length} total):`);
    noSlugDocs.slice(0, 20).forEach(d => {
      console.log(`    ${d.docId}: "${d.name}" [${d.set}]`);
    });
    if (noSlugDocs.length > 20) {
      console.log(`    ... and ${noSlugDocs.length - 20} more`);
    }
    
    // Check if these slugs exist in complete docs (maybe doc ID = set_code format?)
    console.log('\n  Checking if doc IDs look like set_code format...');
    noSlugDocs.slice(0, 5).forEach(d => {
      // Format: XXXX-XXX-XXX (e.g. sm11a-068)
      const isSetCode = /^[a-z]{2,4}\d+[a-z]?-\d{3}$/.test(d.docId);
      console.log(`    ${d.docId} (${d.name}): set_code format? ${isSetCode}`);
    });
  }
}

main().catch(console.error);