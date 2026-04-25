import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const url = `https://snkrdunk.com/search?keyword=${encodeURIComponent("ゴッホピカチュウ")}`;
    console.log(`Fetching ${url}...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9',
      }
    });
    
    console.log("Status: OK");
    const $ = cheerio.load(data);
    
    $('a').each((i, el) => {
       const href = $(el).attr('href');
       if (href && href.match(/\/products\/\w+/)) {
           console.log('Product Link:', href);
       }
    });
    
  } catch (e: any) {
    if (e.response) {
      console.error('Error status:', e.response.status);
    } else {
      console.error('Error:', e.message);
    }
  }
}
test();
