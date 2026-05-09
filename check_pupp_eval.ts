import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const searchUrl = 'https://www.pokemon-card.com/card-search/index.php?keyword=' + encodeURIComponent('メガゲンガーex') + '&sm_and_keyword=true';
  console.log(`Navigating to ${searchUrl}...`);
  await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 4000));
  
  const html = await page.content();
  console.log('details in html:', html.includes('details.php'));
  const snippets = html.split('details.php');
  if (snippets.length > 1) {
    console.log(snippets[0].substr(-50));
  }
  
  await browser.close();
}

run().catch(console.error);
