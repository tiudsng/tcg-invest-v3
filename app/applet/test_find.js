const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  const res = await fetch('https://grading.pokeca-chart.com/svp-en-085/');
  const text = await res.text();
  const $ = cheerio.load(text);
  
  const tables = $('table').toArray();
  tables.forEach((t, i) => {
    console.log('TABLE', i);
    const ths = $(t).find('th').toArray().map(x => $(x).text().trim());
    const tds = $(t).find('td').toArray().map(x => $(x).text().trim());
    console.log('TH:', ths);
    console.log('TD:', tds);
  });
}
run();
