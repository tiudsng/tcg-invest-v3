import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const url = `https://snkrdunk.com`;
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
    
    // find links containing toreca, products, etc.
    $('a').each((i, el) => {
       const href = $(el).attr('href');
       if (href && (href.includes('146897') || href.includes('toreca') || href.includes('pokemon'))) {
           console.log('Interesting Link:', href);
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
