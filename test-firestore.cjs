const {google} = require('google-auth-library');
const fs = require('fs');
const http = require('http');

const sa = JSON.parse(fs.readFileSync('./firebase-admin-sa.json', 'utf8'));

const jwt = new google.auth.JWT(sa.client_email, null, sa.private_key, ['https://www.googleapis.com/auth/datastore']);
jwt.authorize((e, t) => {
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
      console.log('Response:', body.substring(0, 1000));
    });
  });
  req.on('error', e => console.error('req err:', e.message));
  req.write(data);
  req.end();
});
