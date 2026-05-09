/**
 * Backfill missing slugs in pokeca_gold
 * 
 * Strategy:
 * 1. Query all pokeca_gold docs with pagination
 * 2. For docs missing 'slug' field (or slug is null/empty)
 * 3. Fetch SNKRDUNK product page to extract slug
 * 4. Write back to Firestore
 * 
 * Run: node backfill_slugs.mjs
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

async function listDocs(accessToken, pageToken = '') {
  let url = `${BASE_URL}/documents/pokeca_gold?pageSize=500`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  
  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return resp.json();
}

async function updateDoc(accessToken, docId, data) {
  const url = `${BASE_URL}/documents/pokeca_gold/${docId}`;
  
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        slug: { stringValue: data.slug },
        updatedBy: { stringValue: 'bot' },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  
  return resp.json();
}

async function fetchSnkrdunkSlug(snkrdunkId) {
  // Try to get slug from SNKRDUNK product page
  // SNKRDUNK product URL format: https://snkrdunk.com/en/detail/{id}/{slug}
  // The slug is embedded in the page
  
  try {
    const resp = await fetch(`https://snkrdunk.com/en/detail/${snkrdunkId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    if (!resp.ok) return null;
    
    const html = await resp.text();
    
    // Look for slug in page data - SNKRDUNK embeds it in JSON data
    // Pattern: "slug":"xxx" or 'slug':'xxx'
    const slugMatch = html.match(/["']slug["']\s*:\s*["']([a-z0-9-]+)["']/i);
    if (slugMatch) return slugMatch[1];
    
    // Alternative: look for the canonical URL
    const urlMatch = html.match(/snkrdunk\.com\/en\/detail\/\d+\/([a-z0-9-]+)/i);
    if (urlMatch) return urlMatch[1];
    
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  BACKFILL MISSING SLUGS');
  console.log('═══════════════════════════════════════════\n');
  
  const accessToken = await getAccessToken();
  console.log('✓ Authenticated\n');
  
  // Collect all docs
  let allDocs = [];
  let pageToken = '';
  
  do {
    console.log(`  Fetching docs (${allDocs.length} so far)...`);
    const result = await listDocs(accessToken, pageToken);
    
    if (result.documents) {
      allDocs.push(...result.documents);
    }
    
    pageToken = result.nextPageToken || '';
  } while (pageToken);
  
  console.log(`  Total docs: ${allDocs.length}\n`);
  
  // Find docs missing slug
  const missingSlug = allDocs.filter(doc => {
    const fields = doc.fields || {};
    const slug = fields.slug?.stringValue;
    return !slug || slug.trim() === '';
  });
  
  console.log(`  Docs missing slug: ${missingSlug.length}\n`);
  
  if (missingSlug.length === 0) {
    console.log('✅ All docs have slugs!');
    return;
  }
  
  // Show first 10
  console.log('  First 10 missing slug:');
  missingSlug.slice(0, 10).forEach(doc => {
    const name = doc.fields?.name_jp?.stringValue || '(no name)';
    console.log(`    ${doc.name.split('/').pop()}: ${name}`);
  });
  
  if (missingSlug.length > 10) {
    console.log(`    ... and ${missingSlug.length - 10} more`);
  }
  
  // For each missing slug, try to fetch from SNKRDUNK
  console.log('\n  Attempting to fetch slugs from SNKRDUNK...\n');
  
  const success = [];
  const failed = [];
  
  for (const doc of missingSlug) {
    const docId = doc.name.split('/').pop();
    const name = doc.fields?.name_jp?.stringValue || '';
    
    process.stdout.write(`  ${docId} (${name.slice(0, 20)})... `);
    
    const slug = await fetchSnkrdunkSlug(docId);
    
    if (slug) {
      // Write back to Firestore
      const result = await updateDoc(accessToken, docId, { slug });
      if (result.error) {
        console.log(`✗ Write failed: ${result.error.message}`);
        failed.push({ docId, name, reason: result.error.message });
      } else {
        console.log(`✓ → "${slug}"`);
        success.push({ docId, name, slug });
      }
    } else {
      console.log('✗ No slug found');
      failed.push({ docId, name, reason: 'not found on SNKRDUNK' });
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════');
  console.log(`  Success: ${success.length}`);
  console.log(`  Failed: ${failed.length}`);
  
  if (success.length > 0) {
    console.log('\n  Updated docs:');
    success.forEach(s => console.log(`    ${s.docId}: ${s.name} → slug="${s.slug}"`));
  }
  
  if (failed.length > 0) {
    console.log('\n  Failed docs:');
    failed.slice(0, 10).forEach(f => console.log(`    ${f.docId}: ${f.name} (${f.reason})`));
  }
}

main().catch(console.error);