import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://grading.pokeca-chart.com/svp-en-085/', { waitUntil: 'networkidle2' });
  
  const data = await page.evaluate(() => {
    // 尋找包含狀態「PSA10」的 tr，然後它的後一個 td 可能是總數或之類的
    // 等等，我們看看所有的表格
    let results = [];
    document.querySelectorAll('tr').forEach(tr => {
      let tds = [];
      tr.querySelectorAll('td, th').forEach(td => tds.push(td.innerText.trim()));
      if (tds.length > 0) results.push(tds);
    });
    return results;
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
