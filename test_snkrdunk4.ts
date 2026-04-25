import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const url = `https://snkrdunk.com/search/result?keyword=146897`;
    console.log(`Fetching ${url}...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    console.log("Status: OK");
    const $ = cheerio.load(data);
    console.log('Title:', $('title').text());
    
    $('a').each((i, el) => {
       const href = $(el).attr('href');
       if (href && (href.includes('products') || href.includes('146897'))) {
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
