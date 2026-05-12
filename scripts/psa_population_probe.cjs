/**
 * psa_population_probe.cjs — Extract PSA population from PriceCharting
 * Run via: node scripts/psa_population_probe.cjs
 */

const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
puppeteerExtra.use(stealthPlugin);

const TEST_URL = process.argv.includes('--dry-run')
  ? 'https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p'
  : process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
  || 'https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p';

async function main() {
  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  console.log('Navigating to:', TEST_URL);
  const resp = await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  console.log('HTTP Status:', resp.status());
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const body = document.body.innerText;
    const ret = { success: false, psa10: null, psa9: null, total: null, pct: null, snippets: [], bodySnippet: body.slice(0, 400) };

    // Strategy 1: table rows
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

    // Strategy 2: text patterns
    const psa10Match = body.match(/PSA 10[^0-9]*(\d[\d,]*)/i);
    const totalMatch = body.match(/(?:Total|Census)[^0-9]*(\d[\d,]*)/i);
    if (psa10Match) ret.psa10 = psa10Match[1];
    if (totalMatch) ret.total = totalMatch[1];

    // Strategy 3: tables with psa
    document.querySelectorAll('table').forEach(t => {
      const txt = t.innerText;
      if (/psa/i.test(txt)) {
        ret.snippets.push('TABLE: ' + txt.slice(0, 400));
      }
    });

    // Strategy 4: population sections
    document.querySelectorAll('div, section').forEach(s => {
      const t = s.innerText || '';
      if (/population/i.test(t) && t.length < 800) {
        ret.snippets.push('SECTION: ' + t.slice(0, 200));
      }
    });

    // Calculate pct
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
  console.log('Success:', result.success);
  console.log('PSA 10:', result.psa10);
  console.log('PSA 9:', result.psa9);
  console.log('Total:', result.total);
  console.log('Percentage:', result.pct);
  console.log('\nSnippets:');
  result.snippets.forEach(s => console.log(' ', s));
  console.log('\nBody snippet:');
  console.log(result.bodySnippet);

  await browser.close();
  process.exit(result.success ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
