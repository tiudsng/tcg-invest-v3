import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const q = query(collection(db, 'products'), where('card_number', '==', '085'));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log('No products found with card_number "085". Trying partial match or listing some.');
    const allQ = query(collection(db, 'products'), limit(10));
    const allSnap = await getDocs(allQ);
    allSnap.docs.forEach(doc => {
      console.log(`ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
    });
  } else {
    snap.docs.forEach(doc => {
      console.log(`Found ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
    });
  }
}
check().catch(console.error);
