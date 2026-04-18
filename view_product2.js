import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query, where, orderBy } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkProducts() {
  const q = query(collection(db, "products"), orderBy('rank', 'desc'), limit(5));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}
checkProducts();
