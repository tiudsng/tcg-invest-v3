import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
async function run() {
  const res = await fetch('https://grading.pokeca-chart.com/svp-en-085/');
  const text = await res.text();
  const $ = cheerio.load(text);
  $('th').each((i, el) => {
    if ($(el).text().includes('PSA') || $(el).text().includes('鑑定総数')) {
      console.log('Header:', $(el).text().trim());
      console.log('Value:', $(el).next('td').text().trim());
    }
  });
  
  $('td').each((i, el) => {
    if ($(el).text().includes('PSA10')) {
       console.log('TD Content:', $(el).text().trim(), $(el).next().text().trim());
    }
  });
  
  // also dump the basic tables for ALL strings
  $('tr').each((i, el) => {
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if(txt.includes('PSA')) {
      console.log('TR:', txt);
    }
  });
}
run();
