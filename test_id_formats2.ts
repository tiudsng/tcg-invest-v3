import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY || "TW8I2XBIAR696JVHT1F5P0LF0OANSX43DWJ8FACSLKG2TE3LI0ID35YDZBRPQHLD7FSFB74LCJ57US9R";
  const idsToTest = ["146897", "pokemon-146897", "toreca-146897"];
  
  for (const tid of idsToTest) {
    const targetUrl = `https://snkrdunk.com/products/${tid}`;
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=true&stealth_proxy=true&premium_proxy=true&country_code=jp&wait=2000`;
    console.log(`[Scraper] Fetching ${targetUrl}`);
    try {
      const response = await axios.get(scrapingBeeUrl, { timeout: 60000 });
      const $ = cheerio.load(response.data);
      console.log(`Title for ${tid}:`, $('title').text());
    } catch (e: any) {
      console.error(`Error for ${tid}:`, e.message);
      if(e.response && e.response.status === 404) console.log("It's a genuine 404 from target");
    }
  }
}
test();
