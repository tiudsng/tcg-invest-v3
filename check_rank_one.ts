import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkRankOne() {
  const q = query(collection(db, 'list_1'), orderBy('rank', 'asc'), limit(1));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log('No leaderboard data found in "list_1".');
  } else {
    snap.docs.forEach(doc => {
      console.log(`Rank 1 ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
    });
  }
}
checkRankOne().catch(console.error);
