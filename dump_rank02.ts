
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
    console.log('--- FETCHING rank_02 ---');
    const d = await getDoc(doc(db, 'leaderboard', 'rank_02'));
    if (d.exists()) console.log(JSON.stringify(d.data(), null, 2));
    else console.log('rank_02 NOT FOUND');
}

run().catch(console.error);
