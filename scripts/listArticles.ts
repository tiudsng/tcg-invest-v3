import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function listArticles() {
  const snap = await getDocs(collection(db, 'articles'));
  console.log("Current articles in DB:");
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}, Title: ${data.title}`);
  });
  process.exit(0);
}
listArticles();
