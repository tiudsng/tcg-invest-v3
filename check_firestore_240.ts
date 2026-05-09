import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(db, 'products'), where('card_number', '==', '240/193'));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('Not found by exact match.');
    // Let's get all products and filter locally just in case
    const all = await getDocs(query(collection(db, 'products'), limit(500)));
    const matches = all.docs.filter(d => {
        const data = d.data();
        return data.card_number && data.card_number.includes('240');
    });
    console.log('Fuzzy matches:', matches.map(d => d.data().name_jp + ' ' + d.data().card_number));
  } else {
    snap.docs.forEach(doc => {
      console.log('Found:', doc.id, doc.data());
    });
  }
}
run().catch(console.error);
