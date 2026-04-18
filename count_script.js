import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function checkProducts() {
  const querySnapshot = await getDocs(collection(db, "products"));
  console.log("Total in products:", querySnapshot.size);
  
  const querySnapshot1 = await getDocs(collection(db, "list_1"));
  console.log("Total in list_1:", querySnapshot1.size);
  process.exit(0);
}
checkProducts();
