import fs from 'fs';
import https from 'https';

const sa = JSON.parse(fs.readFileSync('./firebase-admin-sa.json', 'utf8'));

// Create signed JWT manually (simplest auth approach)
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 3600;

const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: sa.client_email,
  sub: sa.client_email,
  aud: 'https://oauth2.googleapis.com/token',
  iat,
  exp
})).toString('base64url');

const signingInput = `${header}.${payload}`;
const crypto = await import('crypto');
const sign = crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key);
const signature = sign.toString('base64url');
const jwt = `${signingInput}.${signature}`;

// Exchange JWT for access token
const tokenData = JSON.stringify({
  grant_type: 'urn:ietf:params:oauth2:grant-type:jwt-bearer',
  assertion: jwt
});

const tokenOpts = {
  hostname: 'oauth2.googleapis.com',
  path: '/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(tokenData)
  }
};

const tokenRes = await new Promise((resolve, reject) => {
  const req = https.request(tokenOpts, res => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.write(tokenData); req.end();
});

const tokenResult = JSON.parse(tokenRes.body);
const accessToken = tokenResult.access_token;
console.log('Access token:', accessToken ? accessToken.substring(0, 20) + '...' : 'FAILED: ' + JSON.stringify(tokenResult));

if (!accessToken) {
  console.error('Failed to get access token');
  process.exit(1);
}

// Query Firestore with the correct database ID
const dbId = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';
const firestoreData = JSON.stringify({
  structuredQuery: {
    from: [{ collectionId: 'leaderboard' }],
    limit: 3
  }
});

const fsOpts = {
  hostname: 'firestore.googleapis.com',
  path: `/v1/projects/gen-lang-client-0326385388/databases/${dbId}/documents:runQuery`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + accessToken,
    'Content-Length': Buffer.byteLength(firestoreData)
  }
};

const fsRes = await new Promise((resolve, reject) => {
  const req = https.request(fsOpts, res => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode, body }));
  });
  req.on('error', reject);
  req.write(firestoreData); req.end();
});

console.log('Firestore Status:', fsRes.status);
console.log('Firestore Response:', fsRes.body.substring(0, 2000));
