import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("/firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function checkProducts() {
  const querySnapshot = await getDocs(collection(db, "products"));
  console.log("Total in products:", querySnapshot.size);
  
  const querySnapshot1 = await getDocs(collection(db, "list_1"));
  console.log("Total in list_1:", querySnapshot1.size);
  
  querySnapshot1.docs.slice(0, 2).forEach(d => console.log(d.id, d.data().name_zh, d.data().card_number, d.data().set_name));
}
checkProducts();
