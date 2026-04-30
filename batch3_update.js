// batch3_update.js
// Updates Firebase with PSA10 prices for batch 3 cards (299-398)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateCard(snkrdunkId, docId, price) {
  const productRef = doc(db, 'products', docId);
  const now = new Date().toISOString();
  
  const productUpdate = {
    market_data: {
      psa10_price: price,
      last_updated: now
    },
    updatedBy: 'batch_scrape',
    last_history_sync: now
  };

  try {
    await setDoc(productRef, productUpdate, { merge: true });
    
    // Add history entry
    const historyRef = collection(productRef, 'price_history');
    await addDoc(historyRef, {
      psa10_price: price,
      raw_price: null,
      source: 'scraper',
      createdAt: serverTimestamp()
    });
    
    console.log(`[OK] ${docId}: ${price}`);
    return { docId, price, status: 'ok' };
  } catch (err) {
    console.error(`[FAIL] ${docId}: ${err.message}`);
    return { docId, price, status: 'error', error: err.message };
  }
}

// CLI args: JSON array of {snkrdunk_id, doc_id, psa10_price}
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node batch3_update.js <json_array>');
  process.exit(1);
}

const cards = JSON.parse(args[0]);

async function processAll() {
  const results = [];
  for (const card of cards) {
    const r = await updateCard(card.snkrdunk_id, card.doc_id, card.psa10_price);
    results.push(r);
    await new Promise(r => setTimeout(r, 200)); // slight delay to avoid rate limits
  }
  
  const ok = results.filter(r => r.status === 'ok').length;
  const fail = results.filter(r => r.status === 'error').length;
  console.log(`\nDone. OK=${ok}, Failed=${fail}`);
  
  // Save results
  const fs = await import('fs');
  fs.writeFileSync('/home/agentuser/batch3_firebase_results.json', JSON.stringify(results, null, 2));
}

processAll().catch(console.error);