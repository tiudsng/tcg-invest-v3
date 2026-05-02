import * as cheerio from 'cheerio';
const url = 'https://grading.pokeca-chart.com/s6a-095-069/';

fetch(url)
  .then(res => res.text())
  .then(html => {
    const $ = cheerio.load(html);
    console.log('--- TABLES ---');
    $('table').each((i, table) => {
      console.log(`Table ${i}:`);
      $(table).find('tr').each((j, tr) => {
        const row = $(tr).find('td, th').map((k, td) => $(td).text().trim()).get();
        console.log(row.join(' | '));
      });
      console.log('---');
    });
  });
