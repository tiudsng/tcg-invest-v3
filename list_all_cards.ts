import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

async function check() {
  const collName = 'Pokemon_cards';
  const snapshot = await db.collection(collName).where('card_number', '==', '240/193').get();
  
  if (snapshot.empty) {
    console.log('No matching documents for 240/193.');
  } else {
    snapshot.forEach(doc => {
      console.log(`Found ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
    });
  }
}
check().catch(console.error);
