import "dotenv/config";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : null;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig?.projectId
  });
}

const db = getFirestore(admin.app(), firebaseConfig?.firestoreDatabaseId);

async function checkData() {
  const snap = await db.collection('list_1').orderBy('rank').get();
  const data = snap.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name_zh,
    prices: doc.data().market_data,
    updatedBy: doc.data().updatedBy,
    updatedAt: doc.data().updatedAt
  }));
  console.log(JSON.stringify(data, null, 2));
}

checkData();
