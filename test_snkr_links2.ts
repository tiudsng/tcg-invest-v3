import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const scrapingBeeKey = "TW8I2XBIAR696JVHT1F5P0LF0OANSX43DWJ8FACSLKG2TE3LI0ID35YDZBRPQHLD7FSFB74LCJ57US9R";
  // The correct URL format for Pokemon cards seems to have changed recently on SNKRDUNK.
  // Instead of passing the raw ID, we should try a different path or wait less time
  const targetUrl = `https://snkrdunk.com/toreca/pokemon-card`;
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=true&stealth_proxy=true&premium_proxy=true&country_code=jp&wait=2000`;

  console.log(`[Scraper] Fetching Snkrdunk via ScrapingBee: ${targetUrl}`);
  try {
    const response = await axios.get(scrapingBeeUrl, { timeout: 60000 });
    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);
    console.log("Title!", $('title').text());
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
