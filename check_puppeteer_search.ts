import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const url = 'https://www.pokemon-card.com/card-search/?keyword=メガゲンガーex&sm_and_keyword=true';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  
  const results = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.List_item')).map(d => {
        const link = d.querySelector('a')?.href;
        const name = d.querySelector('.CardList_itemInfoName')?.textContent?.trim();
        const number = d.querySelector('.CardList_itemInfoList')?.textContent?.trim()?.replace(/\s+/g, ' ');
        return { name, number, link };
    });
  });
  console.log('Results:', results.slice(0, 5));
  await browser.close();
}

run().catch(console.error);
