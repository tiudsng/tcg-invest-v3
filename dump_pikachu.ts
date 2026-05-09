
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
    const ids = ['snkrdunk_146897', 'snkrdunk_107574', 'rank_01', 'rank_03'];
    for (const id of ids) {
        console.log(`--- FETCHING ${id} ---`);
        const d1 = await getDoc(doc(db, 'products', id));
        if (d1.exists()) console.log('Products:', JSON.stringify(d1.data(), null, 2));
        
        const d2 = await getDoc(doc(db, 'leaderboard', id));
        if (d2.exists()) console.log('Leaderboard:', JSON.stringify(d2.data(), null, 2));
    }
}

run().catch(console.error);
