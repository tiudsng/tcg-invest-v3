import puppeteer from 'puppeteer';
async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    const targetUrl = 'https://snkrdunk.com/en/trading-cards/730968/used';
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
    
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      labels.forEach(el => {
        if (el.innerText.includes('PSA 10') || el.innerText.includes('PSA10')) {
          const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
          if (radio) { radio.click(); }
        }
      });
    });
    
    await new Promise(r => setTimeout(r, 2000));
    const stats = await page.evaluate(() => {
      const items = document.querySelectorAll('a[href*="/en/trading-cards/used/listings/"]');
      const results: any[] = [];
      items.forEach(item => {
        const text = (item as HTMLElement).innerText;
        results.push(text.replace(/
/g, ' '));
      });
      return results;
    });
    console.log(stats.slice(0, 5));
  } finally {
    await browser.close();
  }
}
main();