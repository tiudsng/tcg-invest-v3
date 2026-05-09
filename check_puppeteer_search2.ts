import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const url = 'https://www.pokemon-card.com/card-search/index.php?keyword=メガゲンガーex&sm_and_keyword=true';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle0' });
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('puppeteer_result.html', html);
  
  await browser.close();
}

run().catch(console.error);
