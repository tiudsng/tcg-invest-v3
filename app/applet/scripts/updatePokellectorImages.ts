import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function searchPokellector(setCode, cardNumber) {
  const num = cardNumber.includes('/') ? cardNumber.split('/')[0] : cardNumber.replace(/^0+/, '');
  const queries = [
    `${setCode} ${num}`,
    `${setCode} ${cardNumber}`
  ];
  
  for (const q of queries) {
    try {
      const url = `https://jp.pokellector.com/search?criteria=${encodeURIComponent(q)}`;
      const req = await fetch(url);
      if (!req.ok) continue;
      const text = await req.text();
      const matches = text.match(/https:\/\/den-cards\.pokellector\.com\/[^\"]+\.thumb\.png/g);
      if (matches && matches.length > 0) {
        return matches[0].replace('.thumb.png', '.png');
      }
    } catch (err) {
      // Ignore
    }
  }
  return null;
}

// Simple concurrency limiter
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function runBatch() {
  const batchIndex = parseInt(process.argv[2]) || 0; // 0 to 9
  const totalBatches = 10;
  
  const snapshot = await getDocs(collection(db, "products"));
  // To ensure stable order, we get all and sort by id
  const docs = snapshot.docs.sort((a, b) => a.id.localeCompare(b.id));
  
  const batchSize = Math.ceil(docs.length / totalBatches);
  const startIdx = batchIndex * batchSize;
  const endIdx = startIdx + batchSize;
  
  const currentBatch = docs.slice(startIdx, endIdx);
  
  console.log(`Starting Batch ${batchIndex + 1}/${totalBatches} [${startIdx} to ${endIdx - 1}] (${currentBatch.length} items)`);
  
  let successCount = 0;
  
  await asyncPool(20, currentBatch, async (document) => {
    const data = document.data();
    if (!data.set_code || !data.card_number) return;
    
    // Only update if it's currently using snkrdunk image or a low-res image, 
    // but the prompt says to download and update, so we update it all if found.
    const url = await searchPokellector(data.set_code, data.card_number);
    if (url) {
      try {
        await updateDoc(document.ref, { image_url: url });
        successCount++;
        // console.log(`Updated: ${data.name_zh || data.name} -> ${url}`);
      } catch (err) {
        console.error("Error updating", document.id);
      }
    }
  });
  
  console.log(`Batch ${batchIndex + 1} completed. Successfully found & updated ${successCount} high-res images from Pokellector.`);
  process.exit(0);
}

runBatch();
