import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-admin-sa.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

const db = admin.firestore();
db.databaseId = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b';

async function main() {
  const lb = await db.collection('leaderboard').doc('rank_09').get();
  const d = lb.data();
  console.log('rank_09 card_id:', d?.card_id);
  console.log('rank_09 image_url:', d?.image_url);
  console.log('rank_09 name:', d?.name);
  console.log('rank_09 set_code:', d?.set_code);

  const pg = await db.collection('pokeca_gold').doc('pokeca_gold_91606').get();
  if (pg.exists) {
    console.log('\npokeca_gold_91606 image_url:', pg.data()?.image_url);
    console.log('high_res_image:', pg.data()?.high_res_image);
    console.log('thumbnail:', pg.data()?.thumbnail);
  } else {
    console.log('\npokeca_gold_91606: NOT FOUND');
  }

  console.log('\n=== All leaderboard image URLs ===');
  for (let i = 1; i <= 10; i++) {
    const entry = await db.collection('leaderboard').doc(`rank_${String(i).padStart(2,'0')}`).get();
    if (entry.exists) {
      const data = entry.data();
      console.log(`rank_${String(i).padStart(2,'0')}: ${data.card_id} | ${data.image_url}`);
    }
  }
}

main().catch(console.error);