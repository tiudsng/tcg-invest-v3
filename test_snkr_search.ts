import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const scrapingBeeKey = "TW8I2XBIAR696JVHT1F5P0LF0OANSX43DWJ8FACSLKG2TE3LI0ID35YDZBRPQHLD7FSFB74LCJ57US9R";
  const targetUrl = `https://snkrdunk.com/search/result?keyword=${encodeURIComponent('ゴッホピカチュウ')}`;
  
  // try stealth to see if it makes a difference inside the site search
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=true&wait_browser=networkidle0`;

  console.log(`Fetching ${targetUrl} via ScrapingBee...`);
  try {
    const response = await axios.get(scrapingBeeUrl, { timeout: 90000 });
    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);
    console.log("Title:", $('title').text());
    
    // search for links containing products
    const links = new Set();
    $('a').each((i, el) => {
       const href = $(el).attr('href');
       if(href && href.includes('/products/')) links.add(href);
    });
    console.log(Array.from(links).slice(0, 10));

  } catch (e: any) {
    if(e.response) {
       console.error("Error status:", e.response.status);
    } else {
       console.error("Error:", e.message);
    }
  }
}
test();
