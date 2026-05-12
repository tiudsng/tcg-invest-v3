/**
 * psa_population_probe.cjs — Extract PSA population from PriceCharting
 * Strategy: Puppeteer → intercept API calls → identify population endpoint
 * Usage:
 *   node scripts/psa_population_probe.cjs
 *   node scripts/psa_population_probe.cjs --url "https://www.pricecharting.com/game/..."
 */

const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

const TEST_URL = process.argv.includes('--dry-run')
  ? 'https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p'
  : process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
  || 'https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p';

const RESULTS = {
  apiCalls: [],
  psaData: null,
};

async function main() {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Capture all network requests
  const apiCalls = [];
  await page.on('request', req => {
    const url = req.url();
    const type = req.resourceType();
    // Capture API/JSON/XHR/fetch calls
    if (type === 'xhr' || type === 'fetch' || type === 'script' || url.includes('api') || url.includes('json')) {
      apiCalls.push({ url, type, resourceType: type });
    }
  });

  // Capture responses
  const apiResponses = [];
  await page.on('response', async resp => {
    const url = resp.url();
    const status = resp.status();
    if (resp.request().resourceType() === 'xhr' || resp.request().resourceType() === 'fetch') {
      try {
        const text = await resp.text();
        apiResponses.push({ url, status, bodySnippet: text.slice(0, 300) });
      } catch (e) {}
    }
  });

  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  console.log('Navigating to:', TEST_URL);
  const resp = await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('HTTP Status:', resp.status());

  // Wait extra for JS to fully render
  await page.waitForTimeout(5000);

  // Extract PSA data via page evaluation
  const data = await page.evaluate(() => {
    const body = document.body.innerText;
    const ret = { success: false, psa10: null, psa9: null, total: null, pct: null, snippets: [] };

    // Look for population table
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0].innerText.trim();
        const val = cells[1].innerText.trim();
        if (/psa\s*10/i.test(label)) ret.psa10 = val;
        if (/psa\s*9/i.test(label)) ret.psa9 = val;
        if (/total|all census/i.test(label)) ret.total = val;
      }
    });

    // Text pattern search
    const psa10Match = body.match(/PSA 10[^0-9]*([\d,]+)/i);
    const totalMatch = body.match(/(?:Total|Census)[^0-9]*([\d,]+)/i);
    if (psa10Match) ret.psa10 = psa10Match[1];
    if (totalMatch) ret.total = totalMatch[1];

    // Look for data in script tags (chart config)
    document.querySelectorAll('script').forEach(s => {
      const txt = s.innerText;
      if (/population|psa.*\d{2,}/i.test(txt) && txt.length < 5000) {
        ret.snippets.push('SCRIPT: ' + txt.slice(0, 300));
      }
    });

    // Look for data attributes
    document.querySelectorAll('[data-population], [data-psa], [data-grade]').forEach(el => {
      ret.snippets.push('DATA: ' + JSON.stringify({
        population: el.dataset.population,
        psa: el.dataset.psa,
        grade: el.dataset.grade
      }));
    });

    if (ret.psa10 && ret.total) {
      const p = parseInt(ret.psa10.replace(/,/g,''));
      const t = parseInt(ret.total.replace(/,/g,''));
      if (!isNaN(p) && !isNaN(t) && t > 0) {
        ret.pct = ((p/t)*100).toFixed(2) + '%';
        ret.success = true;
      }
    }

    return ret;
  });

  console.log('\n=== PSA Population Data ===');
  console.log('Success:', data.success);
  console.log('PSA 10:', data.psa10);
  console.log('PSA 9:', data.psa9);
  console.log('Total:', data.total);
  console.log('Percentage:', data.pct);
  if (data.snippets.length) {
    console.log('\nSnippets:');
    data.snippets.forEach(s => console.log(' ', s));
  }

  console.log('\n=== Captured API Calls ===');
  console.log('Total:', apiCalls.length);
  // Filter for relevant ones
  const relevant = apiCalls.filter(a =>
    /pricecharting|psa|population|grade|market/i.test(a.url) ||
    a.url.includes('api') || a.url.includes('json')
  );
  relevant.forEach(a => console.log(' ', a.type, a.url));
  if (!relevant.length) {
    apiCalls.slice(0, 10).forEach(a => console.log(' ', a.type, a.url));
  }

  console.log('\n=== Relevant Responses ===');
  const relevantResp = apiResponses.filter(r =>
    /psa|population|grade|price/i.test(r.url) ||
    r.bodySnippet.includes('population') || r.bodySnippet.includes('psa')
  );
  relevantResp.forEach(r => {
    console.log(` ${r.status} ${r.url}`);
    console.log(`   Body: ${r.bodySnippet.slice(0, 200)}`);
  });

  RESULTS.apiCalls = apiCalls;
  RESULTS.psaData = data;

  await browser.close();

  const success = data.success || relevantResp.length > 0;
  process.exit(success ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
