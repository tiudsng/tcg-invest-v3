import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const scrapingBeeKey = "TW8I2XBIAR696JVHT1F5P0LF0OANSX43DWJ8FACSLKG2TE3LI0ID35YDZBRPQHLD7FSFB74LCJ57US9R";
  // The correct URL format is likely just /products/146897? But maybe without JS
  const targetUrl = `https://snkrdunk.com/products/146897`;
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=false&stealth_proxy=true&premium_proxy=true&country_code=jp`;

  console.log(`[Scraper] Fetching Snkrdunk via ScrapingBee (NO JS): ${targetUrl}`);
  try {
    const response = await axios.get(scrapingBeeUrl, { timeout: 60000 });
    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);
    console.log("Title!", $('title').text());
  } catch (e: any) {
    if(e.response) {
      console.error("Error status:", e.response.status);
    } else {
      console.error("Error:", e.message);
    }
  }
}
test();
