import { adminDb } from './src/firebase-admin';

async function test() {
  try {
    const doc = await adminDb.collection('products').doc('snkrdunk_146897').get();
    if(doc.exists) {
        console.log("Card found in products:", doc.data());
    } else {
        console.log("Not found in products!");
    }
    
    const doc2 = await adminDb.collection('list_1').doc('rank_01').get();
    if(doc2.exists) {
        console.log("Rank 01:", doc2.data());
    }
    
  } catch (err: any) {
    console.error('Test Failed:', err.message);
  }
}
test();
