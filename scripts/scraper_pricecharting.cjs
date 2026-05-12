/**
 * scraper_pricecharting.cjs — PriceCharting PSA Population Scraper V1
 * 用途: 從 PriceCharting.com 提取 PSA 人口數據
 * 架構: Puppeteer + puppeteer-extra-plugin-stealth (隔離 browser context)
 * 
 * Target URL: https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p
 * 
 * 用法:
 *   node scraper_pricecharting.cjs --dry-run
 *   node scraper_pricecharting.cjs --url "https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p"
 *   node scraper_pricecharting.cjs --test-stealth   # 測試 stealth 能否過 Cloudflare
 */

const puppeteerExtra = require('puppeteer-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_TEST_URL = 'https://www.pricecharting.com/game/pokemon-japanese-promo/armored-mewtwo-365sm-p';
const TIMEOUT = 45000; // Cloudflare challenge can take time

// ─── Logger ───────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ─── Stealth Browser Init ─────────────────────────────────────────────────────

async function initStealthBrowser() {
  puppeteerExtra.use(stealthPlugin);

  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--start-maximized'
    ]
  });

  // Create isolated context (not shared with any other site)
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  // Random viewport
  await page.setViewport({
    width: 1920 + Math.floor(Math.random() * 100),
    height: 1080 + Math.floor(Math.random() * 100),
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false
  });

  // Spoof Accept-Language + UA
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  log('Stealth browser launched (puppeteer-extra + stealth plugin)');

  return { browser, page };
}

// ─── PSA Population Extraction ───────────────────────────────────────────────

async function extractPsaPopulation(page) {
  // Strategy: Look for population table or census data
  // PriceCharting typically shows: grade distribution, auction counts, price range
  return await page.evaluate(() => {
    const result = {
      url: window.location.href,
      title: document.title,
      raw_text: document.body.innerText.slice(0, 2000), // First 2000 chars for debugging
      population_data: null,
      completed_auctions: null,
      grades: {}
    };

    // Try to find population / census section
    // Common selectors on PriceCharting for PSA data:
    const popHeaders = document.querySelectorAll('h2, h3, h4');
    popHeaders.forEach(h => {
      const t = h.innerText.toLowerCase();
      if (t.includes('population') || t.includes('census') || t.includes('psa')) {
        result.population_data = h.parentElement ? h.parentElement.innerText.slice(0, 500) : '';
      }
    });

    // Try grade table (PSA10, PSA9, etc.)
    const gradeRows = document.querySelectorAll('tr');
    gradeRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0].innerText.trim();
        const value = cells[1].innerText.trim();
        // Match PSA grades
        if (/^PSA\s*\d+/i.test(label) || /^BGS\s*\d+/i.test(label)) {
          result.grades[label] = value;
        }
      }
    });

    // Try data attributes
    const jsonData = document.querySelector('script[data-js]');
    if (jsonData) {
      try {
        const text = jsonData.innerText;
        const idx = text.indexOf('{');
        if (idx !== -1) {
          result.json_frag = text.slice(idx, idx + 300);
        }
      } catch (e) {}
    }

    return result;
  });
}

// ─── Main Scrape Logic ────────────────────────────────────────────────────────

async function scrapePricecharting(url) {
  const { browser, page } = await initStealthBrowser();

  try {
    log(`Navigating to ${url}...`);
    
    // Navigate with longer timeout for Cloudflare
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    const status = response ? response.status() : 'no response';
    log(`HTTP Status: ${status}`);

    // Check for Cloudflare challenge
    const cfChallenge = await page.$('#cf-challenge-root, .cf-error-code, [data-translate="complete_secure_check"]');
    if (cfChallenge) {
      log('⚠️  Cloudflare challenge detected, waiting...');
      // Wait for challenge to resolve
      try {
        await page.waitForSelector('body', { timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000)); // Extra wait for JS
      } catch (e) {
        log('Challenge wait timed out');
      }
    }

    // Check final page state
    const finalStatus = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasCf: document.title.includes('Cloudflare') || document.title.includes('Just a moment'),
        hasPricing: document.body.innerText.includes('$') || document.body.innerText.includes('¥'),
        bodySnippet: document.body.innerText.slice(0, 300)
      };
    });

    log(`Page title: "${finalStatus.title}"`);
    log(`Cloudflare: ${finalStatus.hasCf}`);
    log(`Has pricing: ${finalStatus.hasPricing}`);

    if (finalStatus.hasCf) {
      return {
        success: false,
        blocked: true,
        error: 'Cloudflare challenge page',
        title: finalStatus.title
      };
    }

    // Extract PSA population
    const data = await extractPsaPopulation(page);
    return {
      success: true,
      status,
      ...data
    };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  } finally {
    await browser.close();
    log('Browser closed.');
  }
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test-stealth')) {
    log('=== Stealth Plugin Detection Test ===');
    const { browser, page } = await initStealthBrowser();
    await page.goto('https://intoli.com/blog/not-possible-to-block-chrome-headless/chrome-headless-test.html', {
      waitUntil: 'networkidle2',
      timeout: 15000
    }).catch(() => {});
    const result = await page.evaluate(() => ({
      webdriver: navigator.webdriver,
      plugins: navigator.plugins.length,
      languages: navigator.languages
    })).catch(() => ({}));
    log(`navigator.webdriver: ${result.webdriver}`);
    log(`navigator.plugins: ${result.plugins}`);
    log(`navigator.languages: ${result.languages}`);
    await browser.close();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const urlArg = args.find(a => a.startsWith('--url='));
  const testUrl = urlArg ? urlArg.split('=')[1] : DEFAULT_TEST_URL;

  log(`PriceCharting PSA Scraper — ${dryRun ? '[DRY-RUN]' : '[LIVE]'}`);
  log(`Target: ${testUrl}`);
  console.log('─'.repeat(60));

  const result = await scrapePricecharting(testUrl);

  console.log('─'.repeat(60));
  if (result.success) {
    log('✅ Success!');
    log(`Status: ${result.status}`);
    if (result.grades && Object.keys(result.grades).length) {
      log('Grades found:');
      Object.entries(result.grades).forEach(([g, v]) => log(`  ${g}: ${v}`));
    }
    if (result.raw_text) {
      log('Page text (first 500 chars):');
      console.log(result.raw_text.slice(0, 500));
    }
  } else {
    log(`❌ Failed: ${result.error}`);
    if (result.blocked) log('→ Blocked by Cloudflare');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
