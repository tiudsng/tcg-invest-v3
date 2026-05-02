import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function run() {
  const res = await fetch('https://grading.pokeca-chart.com/svp-en-085/');
  const text = await res.text();
  const $ = cheerio.load(text);
  
  $('tr').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    console.log(text);
  });
}
run();
