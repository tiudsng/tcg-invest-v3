import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);
async function get() {
  const d = await getDoc(doc(db, 'leaderboard', 'rank_01'));
  if (d.exists()) {
    const data = d.data();
    console.log('leaderboard rank_01:', JSON.stringify(data, null, 2));
  } else {
    console.log('rank_01 does not exist in leaderboard');
    const all = await getDocs(collection(db, 'leaderboard'));
    if(all.empty) { console.log('no elements in leaderboard')}
    console.log('leaderboard items:', all.docs.map(doc => doc.id).join(', '));
    const d2 = await getDoc(doc(db, 'leaderboard', 'rank_1'));
    if(d2.exists()) console.log(d2.data());
  }
}
get().catch(console.error);
