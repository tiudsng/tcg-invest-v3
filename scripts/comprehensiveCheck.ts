import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import https from 'https';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function checkUrl(url: string): Promise<number> {
    if (!url) return 0;
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            resolve(res.statusCode || 0);
            res.resume();
        });
        req.on('error', () => resolve(0));
        setTimeout(() => {
            req.destroy();
            resolve(0);
        }, 3000);
    });
}

async function run() {
    console.log('--- Checking list_1 ---');
    const snap = await getDocs(collection(db, 'list_1'));
    const docs = snap.docs.sort((a,b) => (a.data().rank || 0) - (b.data().rank || 0));
    
    for (const d of docs) {
        const data = d.data();
        const url = data.image_url;
        const status = await checkUrl(url);
        
        // Also check what getHighResImage would return
        const cardId = data.card_id;
        const fbUrl = cardId?.startsWith('snkrdunk_') ? `https://storage.googleapis.com/gen-lang-client-0326385388.firebasestorage.app/card_images/${cardId}.webp` : null;
        const fbStatus = fbUrl ? await checkUrl(fbUrl) : 'N/A';

        console.log(`[Rank ${data.rank}] ${data.name_zh} | card_id: ${cardId} | db_url: ${url} (${status}) | fb_url: ${fbUrl} (${fbStatus})`);
    }
    process.exit(0);
}

run();
