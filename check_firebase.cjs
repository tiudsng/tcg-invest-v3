const admin = require('firebase-admin');
const { credential } = admin;

// Use the default export properly
const initializeApp = admin.default ? admin.default.initializeApp : admin.initializeApp;
const certFn = credential.cert;

const serviceAccount = require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json');
initializeApp({ credential: certFn(serviceAccount) });

const { getFirestore, doc, getDoc } = require('firebase-admin/firestore');
const db = getFirestore();

async function main() {
  // Check leaderboard/rank_01
  try {
    const snap = await getDoc(doc(db, 'leaderboard', 'rank_01'));
    if (snap.exists()) {
      const d = snap.data();
      console.log('=== leaderboard/rank_01 ===');
      console.log('name_en:', d.name_en);
      console.log('price:', d.price);
      console.log('card_id:', d.card_id);
      console.log('snkrdunk_id:', d.snkrdunk_id);
      console.log('psa_data.total_graded:', d.psa_data?.total_graded);
      console.log('psa_data.psa10_count:', d.psa_data?.psa10_count);
      console.log('psa_data.psa10_ratio:', d.psa_data?.psa10_ratio);
      console.log('market_data.psa10_price:', d.market_data?.psa10_price);
      console.log('market_data.raw_price:', d.market_data?.raw_price);
    } else {
      console.log('leaderboard/rank_01 NOT FOUND');
    }
  } catch(e) { console.error('leaderboard error:', e.message); }

  // Also check products/rank_01
  try {
    const snap2 = await getDoc(doc(db, 'products', 'rank_01'));
    if (snap2.exists()) {
      const d = snap2.data();
      console.log('\n=== products/rank_01 ===');
      console.log('name_en:', d.name_en);
      console.log('price:', d.price);
      console.log('psa_data.total_graded:', d.psa_data?.total_graded);
      console.log('psa_data.psa10_count:', d.psa_data?.psa10_count);
      console.log('market_data.psa10_price:', d.market_data?.psa10_price);
      console.log('market_data.raw_price:', d.market_data?.raw_price);
    } else {
      console.log('\nproducts/rank_01 NOT FOUND');
    }
  } catch(e) { console.error('products error:', e.message); }
}
main().catch(console.error);