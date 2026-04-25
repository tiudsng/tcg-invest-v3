import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const url = `https://snkrdunk.com/brands/pokemon`;
    console.log(`Fetching ${url}...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    console.log("Status: OK");
    const $ = cheerio.load(data);
    
    let ok = false;
    $('a').each((i, el) => {
       const href = $(el).attr('href');
       if (href && href.includes('products')) {
           console.log('Product Link:', href);
           ok = true;
       }
    });
    if(!ok) console.log(data.substring(0, 500));
    
  } catch (e: any) {
    if (e.response) {
      console.error('Error status:', e.response.status);
    } else {
      console.error('Error:', e.message);
    }
  }
}
test();
