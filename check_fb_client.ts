import { db } from './src/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function test() {
  try {
    const d = await getDoc(doc(db, 'list_1', 'rank_01'));
    if(d.exists()) {
        console.log("Rank 01:", d.data());
    } else {
        console.log("Not found in list_1");
    }
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
test();
