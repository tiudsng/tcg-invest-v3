import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, orderBy, updateDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function searchPokellector(setCode, cardNumber) {
  const num = cardNumber.includes('/') ? cardNumber.split('/')[0] : cardNumber.replace(/^0+/, ''); // e.g. 010 -> 10
  const queries = [
    `${setCode} ${num}`,
    `${setCode} ${cardNumber}`
  ];
  
  for (const q of queries) {
    const url = `https://jp.pokellector.com/search?criteria=${encodeURIComponent(q)}`;
    const text = await fetch(url).then(r => r.text());
    const matches = text.match(/https:\/\/den-cards\.pokellector\.com\/[^\"]+\.thumb\.png/g);
    if (matches && matches.length > 0) {
      return matches[0].replace('.thumb.png', '.png');
    }
  }
  return null;
}

async function runBatch() {
  const q = query(collection(db, "products"), orderBy("rank", "asc"), limit(5));
  const snapshot = await getDocs(q);
  
  for (const document of snapshot.docs) {
    const data = document.data();
    console.log(`Processing: ${data.name_zh} (${data.set_code} ${data.card_number})`);
    
    if (data.set_code && data.card_number) {
      const url = await searchPokellector(data.set_code, data.card_number);
      if (url) {
        console.log(` -> Found: ${url}`);
        // await updateDoc(document.ref, { image_url: url });
      } else {
        console.log(` -> Not found on Pokellector`);
      }
    }
  }
  process.exit(0);
}
runBatch();
