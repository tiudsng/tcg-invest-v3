import axios from "axios";

async function run() {
  const headers = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" };
  try {
     const r1 = await axios.get("https://snkrdunk.com/trading-cards/146897", { headers });
     const html = r1.data as string;
     console.log("Success Trading Card:", html.length);
  } catch(e: any) { 
     console.log("Error:", e.message); 
     if (e.response) {
         console.log("Status:", e.response.status);
         console.log("Response:", typeof e.response.data === 'string' ? e.response.data.substring(0, 200) : 'obj');
     }
  }
}
run();
