import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function check() {
  const q = query(collection(db, 'list_1'), orderBy('rank', 'asc'), limit(15));
  const snap = await getDocs(q);
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.rank === 10) {
      console.log('Rank 10 Doc ID:', doc.id);
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  });
  process.exit(0);
}
check();
