/**
 * Explore pokeca_gold collection structure
 * Find all docs and their field structure
 */

import jwt from 'jsonwebtoken';

const PROJECT_ID = 'gen-lang-client-0326385388';
const DATABASE_ID = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;

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

async function listCollectionDocs(accessToken, collPath, pageToken = '') {
  let url = `https://firestore.googleapis.com/v1/${collPath}?pageSize=500`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return resp.json();
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EXPLORE POKECA COLLECTIONS');
  console.log('═══════════════════════════════════════════\n');
  
  const accessToken = await getAccessToken();
  
  // Check pokeca_gold
  console.log('[1] Exploring pokeca_gold collection...\n');
  
  let allDocs = [];
  let pageToken = '';
  
  do {
    const result = await listCollectionDocs(accessToken, `${BASE_URL}/documents/pokeca_gold`, pageToken);
    
    if (result.documents) {
      allDocs.push(...result.documents);
    }
    
    pageToken = result.nextPageToken || '';
    if (pageToken) console.log(`  Fetched ${allDocs.length} docs, getting more...`);
  } while (pageToken);
  
  console.log(`  Total docs in pokeca_gold: ${allDocs.length}\n`);
  
  if (allDocs.length > 0) {
    // Show first 5 docs with all fields
    console.log('  First 5 docs (field summary):\n');
    
    allDocs.slice(0, 5).forEach((doc, i) => {
      const docId = doc.name.split('/').pop();
      const fields = doc.fields || {};
      const fieldNames = Object.keys(fields).sort();
      
      console.log(`  [${i+1}] ${docId}`);
      fieldNames.forEach(fn => {
        const f = fields[fn];
        let val = '';
        if (f.stringValue) val = f.stringValue.slice(0, 40);
        else if (f.integerValue) val = f.integerValue;
        else if (f.timestampValue) val = f.timestampValue;
        else if (f.mapValue) val = `{${Object.keys(f.mapValue.fields || {}).join(', ')}}`;
        else if (f.arrayValue) val = `[${f.arrayValue.values?.length || 0} items]`;
        else val = JSON.stringify(f).slice(0, 40);
        
        console.log(`       ${fn}: ${val}`);
      });
      console.log('');
    });
    
    // Count docs with/without slug
    const withSlug = allDocs.filter(d => {
      const slug = d.fields?.slug?.stringValue;
      return slug && slug.trim() !== '';
    });
    
    const withoutSlug = allDocs.filter(d => {
      const slug = d.fields?.slug?.stringValue;
      return !slug || slug.trim() === '';
    });
    
    console.log('  Stats:');
    console.log(`    With slug: ${withSlug.length}`);
    console.log(`    Without slug: ${withoutSlug.length}`);
    
    if (withoutSlug.length > 0 && withoutSlug.length <= 20) {
      console.log('\n  Docs missing slug:');
      withoutSlug.forEach(d => {
        const docId = d.name.split('/').pop();
        const name = d.fields?.name_jp?.stringValue || '(no name)';
        console.log(`    ${docId}: ${name}`);
      });
    }
  }
}

main().catch(console.error);