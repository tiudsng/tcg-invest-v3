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

async function getDoc(accessToken, docId) {
  const DB = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
  const r = await fetch(`${DB}/documents/pokeca_gold/${docId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return r.json();
}

async function main() {
  const accessToken = await getAccessToken();
  
  // Compare complete vs incomplete doc
  const pair = await Promise.all([getDoc(accessToken, '93060'), getDoc(accessToken, '120746')]);
  
  const fields0 = Object.keys(pair[0].fields || {}).sort();
  const fields1 = Object.keys(pair[1].fields || {}).sort();
  
  console.log('=== COMPLETE DOC: 93060 (ピカチュウ) ===');
  fields0.forEach(f => {
    const v = pair[0].fields[f];
    console.log(`  ${f}: ${JSON.stringify(v).slice(0, 80)}`);
  });
  
  console.log('\n=== INCOMPLETE DOC: 120746 (デカヌチャンex SAR) ===');
  fields1.forEach(f => {
    const v = pair[1].fields[f];
    console.log(`  ${f}: ${JSON.stringify(v).slice(0, 80)}`);
  });
  
  console.log('\n=== FIELD COMPARISON ===');
  const in0Not1 = fields0.filter(f => !fields1.includes(f));
  const in1Not0 = fields1.filter(f => !fields0.includes(f));
  console.log('In 93060 but not 120746:', in0Not1.join(', '));
  console.log('In 120746 but not 93060:', in1Not0.join(', '));
}

main().catch(console.error);