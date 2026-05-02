import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://grading.pokeca-chart.com/s6a-095-069/', { waitUntil: 'networkidle2' });
  
  const data = await page.evaluate(() => {
    const tbody = document.querySelector('#item-grd-table');
    if (!tbody) return 'No tbody found';
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    return rows.map(tr => {
      const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      return cols.join(' | ');
    });
  });
  
  console.log('Result:', data);
  await browser.close();
})();
