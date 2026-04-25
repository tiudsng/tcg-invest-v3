import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  const scrapingBeeKey = "TW8I2XBIAR696JVHT1F5P0LF0OANSX43DWJ8FACSLKG2TE3LI0ID35YDZBRPQHLD7FSFB74LCJ57US9R";
  const targetUrl = `https://snkrdunk.com/products/146897`;
  
  // Notice premium_proxy=false, sometimes the normal residential routing works better
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(targetUrl)}&render_js=true&wait_browser=networkidle0`;

  console.log(`Fetching ${targetUrl} via ScrapingBee...`);
  try {
    const response = await axios.get(scrapingBeeUrl, { timeout: 90000 });
    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);
    console.log("Title:", $('title').text());
    
    console.log($('body').text().substring(0, 500));

  } catch (e: any) {
    if(e.response) {
       console.error("Error status:", e.response.status);
    } else {
       console.error("Error:", e.message);
    }
  }
}
test();
