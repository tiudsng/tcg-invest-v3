import axios from 'axios';

async function testPsa() {
  try {
     console.log("Navigating to PSA...");
     const query = encodeURIComponent("van gogh pikachu 085");
     const html = await axios.get(`https://www.psacard.com/search?q=${query}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36" }
     });
     console.log("Status:", html.status, "Length:", html.data.length);
     console.log(html.data.substring(0, 300));
  } catch(e) {
     console.error(e.message);
  }
}
testPsa();
