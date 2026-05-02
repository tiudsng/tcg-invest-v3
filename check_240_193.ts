import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const collectionsToCheck = ['Pokemon_cards', 'products'];
  for (const collName of collectionsToCheck) {
      console.log(`Checking ${collName}...`);
      const q = query(collection(db, collName), where('card_number', '==', '240/193'));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        snap.docs.forEach(doc => {
          console.log(`Found in ${collName}. ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
        });
        return;
      }
  }
  console.log('Not found.');
}
check().catch(console.error);
