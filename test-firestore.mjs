import { createRequire } from 'module';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { google } = require('google-auth-library');
const sa = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-admin-sa.json'), 'utf8'));

const jwt = new google.auth.JWT(sa.client_email, null, sa.private_key, ['https://www.googleapis.com/auth/datastore']);
jwt.authorize(async (e, t) => {
  if (e) { console.error('auth err:', e.message); process.exit(1); }
  const token = t.access_token;
  console.log('Got token:', token.substring(0, 20) + '...');

  // Try Datastore runQuery
  const data = JSON.stringify({
    query: { kind: [{ name: 'leaderboard' }], limit: 3 }
  });

  const opts = {
    hostname: 'datastore.googleapis.com',
    path: '/v1/projects/gen-lang-client-0326385388/databases/(default)/runQuery',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'Content-Length': Buffer.byteLength(data)
    }
  };

  const req = http.request(opts, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', body.substring(0, 1500));
    });
  });
  req.on('error', e => console.error('req err:', e.message));
  req.write(data);
  req.end();
});
