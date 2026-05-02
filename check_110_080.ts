import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  // Try searching products by card_number
  const q = query(collection(db, 'products'), where('card_number', '==', '110/080'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log('No exact match for card_number "110/080".');
    // Try searching all, filter manually to be robust
    const all = await getDocs(collection(db, 'products'));
    const matches = all.docs.filter(d => 
        (d.data().card_number && d.data().card_number.includes('110')) 
        || (d.data().name_zh && d.data().name_zh.includes('110'))
    );
    if (matches.length > 0) {
        matches.forEach(d => console.log(`Potential Match ID: ${d.id}, Data: ${JSON.stringify(d.data())}`));
    } else {
        console.log('No matches found for "110" in products.');
    }
  } else {
    snap.docs.forEach(doc => {
      console.log(`Found ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
    });
  }
}
check().catch(console.error);
