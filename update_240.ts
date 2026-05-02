import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const docRef = doc(db, 'products', 'snkrdunk_724996');
  // Update to the official image URL temporarily
  try {
    await updateDoc(docRef, {
      image_url_fallback: 'https://www.pokemon-card.com/assets/images/card_images/large/M2a/050000_P_MGENGAEX.jpg'
    });
    console.log('Updated snkrdunk_724996 fallback URL');
  } catch(e) {
    console.error('Update failed:', e);
  }
}
run().catch(console.error);
