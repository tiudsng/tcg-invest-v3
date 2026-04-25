import axios from 'axios';

async function test() {
  try {
    const url = `https://snkrdunk.com/brands/pokemon`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    
    // search for /products/ followed by anything
    const matches = data.match(/\/products\/[A-Za-z0-9_-]+/g);
    if(matches) {
       console.log("Found matches:", Array.from(new Set(matches)).slice(0,10));
    } else {
       console.log("No product links found in source.");
    }
    
  } catch (e: any) {
    console.error(e.response ? e.response.status : e.message);
  }
}
test();
