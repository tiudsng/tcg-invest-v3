import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

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

async function getDoc(accessToken, docId) {
  const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
  const r = await fetch(`${DB}/documents/pokeca_gold/${docId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return r.json();
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  DEEP DIVE: CHECK ALL FIELDS');
  console.log('═══════════════════════════════════════════\n');
  
  const accessToken = await getAccessToken();
  
  // Check 5 docs - 3 with slug, 2 without
  const testIds = ['93060', '120746', '105536', '91147', '162094'];
  
  for (const id of testIds) {
    const json = await getDoc(accessToken, id);
    const f = json.fields || {};
    
    console.log(`\n[${id}] "${f.name_jp?.stringValue || ''}"`);
    console.log(`  set_code: ${f.set_code?.stringValue || '(MISSING)'}`);
    console.log(`  card_number: ${f.card_number?.stringValue || '(MISSING)'}`);
    console.log(`  slug: ${f.slug?.stringValue || '(MISSING)'}`);
    console.log(`  display: ${f.display?.stringValue || '(MISSING)'}`);
    console.log(`  img_url: ${f.img_url?.stringValue || '(MISSING)'}`);
    console.log(`  image_url: ${f.image_url?.stringValue || '(MISSING)'}`);
    console.log(`  market_data: ${f.market_data ? '✓' : '(MISSING)'}`);
    console.log(`  psa_data: ${f.psa_data ? '✓' : '(MISSING)'}`);
    console.log(`  psa10: ${f.psa10?.integerValue || '(MISSING)'}`);
    console.log(`  snkrdunk_id: ${f.snkrdunk_id?.stringValue || '(MISSING)'}`);
    
    if (f.market_data?.mapValue) {
      const md = f.market_data.mapValue.fields;
      console.log(`  market_data.psa10_price: ${md.psa10_price?.integerValue || '(MISSING)'}`);
      console.log(`  market_data.psa10_latest_jpy: ${md.psa10_latest_jpy?.integerValue || '(MISSING)'}`);
    }
  }
  
  console.log('\n\n[CONCLUSION]');
  console.log('If all 5 docs have img_url, then SNKRDUNK CDN is NOT needed for display.');
  console.log('CardReader should use img_url from Firestore (pokeca-chart CDN) instead of getSnkrdunkImageUrl().');
}

main().catch(console.error);