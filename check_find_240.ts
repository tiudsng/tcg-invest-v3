import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  const url = 'https://www.pokemon-card.com/card-search/?keyword=240/193&sm_and_keyword=true';
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle2' });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  // Find search results
  // If there's an element we can click:
  try {
    await page.waitForSelector('#card-show-id0', { timeout: 5000 });
    console.log('Found card-show-id0. Clicking...');
    await page.click('#card-show-id0');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Evaluate to find image
    const imgs = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Array.from(images).filter(i => i.src.includes('card_images')).map(i => i.src);
    });
    
    console.log('Result images:', imgs);
  } catch (err) {
    console.log('Could not find card-show-id0 or error:', err.message);
    const html = await page.content();
    console.log('Page HTML preview:', html.substring(0, 1000));
    const list = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.List_item')).map(d => d.textContent);
    });
    console.log('List items:', list);
  }
  
  await browser.close();
}

run().catch(console.error);
