/**
 * scraper_snkrdunk.cjs — SNKRDUNK Price Sync V1
 * 用途: 從 SNKRDUNK 同步 JPY 市場成交價到 Firestore new_products
 * 架構: Browser automation (Playwright) + Firestore batch write
 * 
 * Selector 參考 (已在 CVM 驗證):
 *   - Sales history:  ul.sales-history.item-list li.used
 *   - Grade:         p.size (e.g. "PSA10", "PSA9", "A", "B")
 *   - Price:         p.price (e.g. "¥900,000")
 *   - Lowest ask:    .product-lowest-price
 * 
 * 用法:
 *   node scraper_snkrdunk.cjs                  # 全量 sync new_products
 *   node scraper_snkrdunk.cjs --dry-run        # 不寫入，僅模擬
 *   node scraper_snkrdunk.cjs --limit 5        # 前 5 張 (測試用)
 */

const { Firestore } = require('@google-cloud/firestore');
const puppeteer = require('puppeteer');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────

const JPY_TO_HKD = 0.0512;
const COLLECTION = 'new_products';
const DELAY_MIN = 6000;  // ms — 反爬 random delay 下界
const DELAY_MAX = 12000; // ms — 反爬 random delay 上界
const BATCH_SIZE = 10;

// ─── Firebase 初始化 (Client SDK — 支援 databaseId) ────────────────────────────

const serviceAccount = require(path.join(
  process.env.HOME || '/home/ubuntu',
  '.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'
));

const db = new Firestore({
  credentials: serviceAccount,
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

// Firestore FieldValue (Server SDK compatibility)
const FieldValue = require('@google-cloud/firestore').FieldValue || {
  serverTimestamp: () => new Date()
};
// ─── Logger ───────────────────────────────────────────────────────────────────

const W = 52;
const LINE = '─';

function bar() { return LINE.repeat(W); }

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logOk(name, psa10Jpy, hkd) {
  const p = psa10Jpy ? `¥${psa10Jpy.toLocaleString()}` : 'N/A';
  const h = hkd ? `HKD ${hkd.toLocaleString()}` : '';
  console.log(`  ✅ ${name.slice(0, 30)} → ${p} ${h}`);
}

function logSkip(name, reason) {
  console.log(`  ⏭  跳过: ${name} (${reason})`);
}

function logErr(name, err) {
  console.log(`  ❌ ${name} → ${err.message}`);
}

// ─── Browser Scraper ─────────────────────────────────────────────────────────

let browser = null;
let page = null;

async function initBrowser() {
  if (browser) return;
  browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  page = await browser.newPage();
  // 偽裝 UA
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
  });
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  log('Browser launched (headless)');
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

async function scrapeOne(snkrdunkId) {
  const url = `https://snkrdunk.com/apparels/${snkrdunkId}`;

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // JS 動態渲染，需等 DOM
    await page.waitForSelector('ul.sales-history', { timeout: 10000 }).catch(() => {});

    // Inject 提取腳本 (已驗證 selector)
    const result = await page.evaluate(() => {
      const sales = document.querySelectorAll('ul.sales-history.item-list li.used');
      const gradePrices = {};
      
      sales.forEach(li => {
        const gradeEl = li.querySelector('p.size');
        const priceEl = li.querySelector('p.price');
        const grade = gradeEl ? gradeEl.innerText.trim() : 'unknown';
        const priceText = priceEl ? priceEl.innerText.trim() : '';
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
        if (price > 0 && (!gradePrices[grade] || price > gradePrices[grade])) {
          gradePrices[grade] = price;
        }
      });

      // Lowest ask
      let lowestAsk = null;
      const lowestEl = document.querySelector('.product-lowest-price');
      if (lowestEl) {
        const m = lowestEl.innerText.match(/¥([0-9,]+)/);
        if (m) lowestAsk = parseInt(m[1].replace(/,/g, ''));
      }

      return {
        best_by_grade: gradePrices,
        lowest_ask: lowestAsk
      };
    });

    // 取 PSA10 成交價
    const psa10Price = result.best_by_grade['PSA10'] || null;

    return {
      success: true,
      psa10_last_sale: psa10Price,
      lowest_ask: result.lowest_ask,
      best_by_grade: result.best_by_grade
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 0;

  log(`SNKRDUNK Sync — ${dryRun ? '[DRY-RUN]' : '[LIVE WRITE]'}${limit ? ` --limit=${limit}` : ''}`);
  console.log(bar());

  // 1. Query Firestore — 取得所有有 snkrdunk_id 的 doc
  const snap = await db.collection(COLLECTION)
    .where('snkrdunk_id', '!=', null)
    .get();

  const cards = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.snkrdunk_id) {
      cards.push({
        id: d.id,
        name_jp: data.name_jp || data.name || '未知',
        snkrdunk_id: data.snkrdunk_id
      });
    }
  });

  log(`Found ${cards.length} cards with snkrdunk_id`);
  console.log(bar());

  if (cards.length === 0) {
    log('No cards to sync. Exiting.');
    return;
  }

  // 2. Init browser
  await initBrowser();

  // 3. Scrape each card
  const results = [];
  let processed = 0;

  for (const card of cards) {
    processed++;
    if (limit && processed > limit) break;

    const name = card.name_jp;
    log(`[${processed}/${limit || cards.length}] Scraping ${name} (id=${card.snkrdunk_id})...`);

    const scrapeResult = await scrapeOne(card.snkrdunk_id);

    if (scrapeResult.success) {
      const { psa10_last_sale, lowest_ask, best_by_grade } = scrapeResult;
      const hkd = psa10_last_sale ? Math.round(psa10_last_sale * JPY_TO_HKD) : null;
      const raw_hkd = lowest_ask ? Math.round(lowest_ask * JPY_TO_HKD) : null;

      if (!dryRun) {
        const patchData = {
          'market_data.updatedAt': FieldValue.serverTimestamp ? FieldValue.serverTimestamp() : new Date(),
          'market_data.updatedBy': '小籠包_snkrdunk_v1',
          'market_data.psa10_last_sale': psa10_last_sale,
          'market_data.psa10_hkd_lowest': hkd,
          'market_data.raw_lowest': lowest_ask ? `¥${lowest_ask.toLocaleString()}` : null,
          'market_data.raw_hkd_lowest': raw_hkd,
          'market_data.snkrdunk_id': card.snkrdunk_id,
          'market_data.source': 'snkrdunk',
          'market_data.best_by_grade': best_by_grade
        };
        await db.collection(COLLECTION).doc(card.id).update(patchData);
      }

      logOk(name, psa10_last_sale, hkd);
      results.push({ id: card.id, name, psa10_last_sale, hkd, lowest_ask });

    } else {
      logErr(name, scrapeResult.error);
      results.push({ id: card.id, name, error: scrapeResult.error });
    }

    // 反爬 delay (skip last item)
    if (processed < (limit || cards.length)) {
      const delay = Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN)) + DELAY_MIN;
      log(`  💤 sleep ${(delay/1000).toFixed(1)}s`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // 4. Summary
  console.log(bar());
  const ok = results.filter(r => r.psa10_last_sale).length;
  const fail = results.filter(r => r.error).length;
  log(`Done — ✅ ${ok} synced, ❌ ${fail} failed, ⏭  ${results.length - ok - fail} skipped`);
  
  if (!dryRun) {
    log('Firestore updated successfully.');
  }

  await closeBrowser();
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  closeBrowser().finally(() => process.exit(1));
});