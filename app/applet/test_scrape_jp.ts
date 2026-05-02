import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    // Using the JP URL to get JPY directly? Wait, does the Japanese site have the used listings?
    // Let's try the Japanese site:
    const id = "730968";
    const jpUrl = `https://snkrdunk.com/trading-cards/${id}/used`;
    console.log("Goto JP:", jpUrl);
    await page.goto(jpUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    console.log("Clicking PSA 10 filter (JP)...");
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      labels.forEach(el => {
        if (el.innerText.includes('PSA10') || el.innerText.includes('PSA 10')) {
          const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
          if (radio) {
            radio.click();
            console.log("Clicked PSA 10 filter");
          }
        }
      });
    });

    await new Promise(r => setTimeout(r, 2000));

    const stats = await page.evaluate(() => {
      // The href might not have "/en/" if we are on the JP site
      const items = document.querySelectorAll('a[href*="/trading-cards/used/listings/"]');
      const results: { price: number, grade: string, isSold: boolean, currency: string }[] = [];
      
      items.forEach(item => {
        const text = (item as HTMLElement).innerText;
        // Looking for ¥ symbol
        const priceMatch = text.match(/(SG\s*\$|US\s*\$|¥)\s*([\d,]+)/);
        const gradeMatch = text.match(/(SOLD\s*|売り切れ\s*)?PSA\s*(\d+)/i);
        
        if (priceMatch) {
          results.push({
            price: parseInt(priceMatch[2].replace(/,/g, ''), 10),
            currency: priceMatch[1],
            grade: gradeMatch ? gradeMatch[2] : 'Raw',
            isSold: gradeMatch ? !!gradeMatch[1] : (text.toUpperCase().includes('SOLD') || text.includes('完売') || text.includes('売り切れ'))
          });
        }
      });
      return results;
    });

    console.log("Scraped stats (JP):", stats);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

main();
