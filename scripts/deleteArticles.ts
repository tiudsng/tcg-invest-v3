import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

async function checkAndDelete() {
  const snap = await getDocs(collection(db, 'articles'));
  const targetTitles = [
    "2026 香港熱抄日文寶可夢卡牌情報 (JPN Edition)",
    "收藏家聖杯：為什麼初版噴火龍能賣出天價？",
    "本週卡價升幅榜", // Could be typo in user request "磅" vs "榜"
    "本週卡價升幅磅", 
    "寶可夢 TCG 市場升溫中！2026 年上半年趨勢分析"
  ];
  
  for (const item of snap.docs) {
    const data = item.data();
    console.log("Found article:", data.title);
    if (targetTitles.includes(data.title) || data.title.includes("升幅")) {
      console.log("Deleting:", data.title);
      await deleteDoc(doc(db, 'articles', item.id));
    }
  }
  process.exit(0);
}
checkAndDelete();
