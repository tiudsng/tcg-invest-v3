import axios from 'axios';
import fs from 'fs';

async function run() {
  const headers = { 
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  try {
     const p = await axios.get('https://snkrdunk.com/en/trading-cards/165243', { headers });
     const titleMatch = p.data.match(/<title>(.*?)<\/title>/);
     console.log(titleMatch ? titleMatch[1] : 'No title');
     
     const imgMatch = p.data.match(/<meta property="og:image" content="(.*?)"/);
     console.log(imgMatch ? imgMatch[1] : 'No image');
  } catch(e) {
     console.log('err:', e.message);
  }
}
run();
