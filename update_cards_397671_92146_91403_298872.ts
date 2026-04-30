import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Load config manually
const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const projectId = firebaseConfig.projectId;

process.env.GOOGLE_CLOUD_PROJECT = projectId;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: projectId
  });
}

const db = getFirestore(admin.app(), databaseId);

// Card data with PSA10 prices from snkrdunk history section
// Exchange: JPY * 0.043 = HKD
const cardsData: Record<string, {
  psa10_price_jpy: number | null;
  psa10_price_hkd: number | null;
  name: string;
  notes: string;
}> = {
  '397671': {
    psa10_price_jpy: 42000,
    psa10_price_hkd: 1806,
    name: 'ヒトカゲ S [SM8b 166/150](ハイクラスパックGX「ウルトラシャイニー」)',
    notes: 'Most recent PSA10 sold: ¥42,000 (3日前). Range: ¥12,500-¥45,000'
  },
  '92146': {
    psa10_price_jpy: null,
    psa10_price_hkd: null,
    name: 'フリーザー: 旧裏[PMCG-QS No.144](クイックスターターギフト)',
    notes: 'No sales history available. Listing only: ¥788,000 PSA10'
  },
  '91403': {
    psa10_price_jpy: 900000,
    psa10_price_hkd: 38700,
    name: 'あったかピカチュウ: プロモ[XY-P 094/XY-P](プロモーションカード「XY-P」)',
    notes: 'Most recent PSA10 sold: ¥900,000 (2026/04/01). Range: ¥209,800-¥900,000'
  },
  '298872': {
    psa10_price_jpy: 55555,
    psa10_price_hkd: 2388.87,
    name: '皮卡丘: プロモ P [S-P 024](Pokemon Card Game Sword & Shield Promo Card Pack "1st edition")',
    notes: 'Most recent PSA10 sold: ¥55,555 (21時間前). Range: ¥53,000-¥109,800'
  }
};

async function updateCards() {
  const results: Record<string, any> = {};
  
  for (const [cardId, data] of Object.entries(cardsData)) {
    try {
      const docRef = db.collection('cards_database').doc(cardId);
      
      const updateData = {
        psa10_price_jpy: data.psa10_price_jpy,
        psa10_price_hkd: data.psa10_price_hkd,
        psa10_updated: admin.firestore.FieldValue.serverTimestamp(),
        source: 'snkrdunk',
        notes: data.notes
      };
      
      await docRef.set(updateData, { merge: true });
      
      results[cardId] = {
        status: 'success',
        psa10_price_jpy: data.psa10_price_jpy,
        psa10_price_hkd: data.psa10_price_hkd,
        name: data.name
      };
      console.log(`Updated card ${cardId}: JPY ${data.psa10_price_jpy} = HKD ${data.psa10_price_hkd}`);
    } catch (err) {
      results[cardId] = {
        status: 'error',
        error: (err as Error).message
      };
      console.error(`Error updating card ${cardId}:`, err);
    }
  }
  
  // Save results
  fs.writeFileSync('/home/agentuser/snkrdunk_4cards_psa10_update_results.json', JSON.stringify(results, null, 2));
  console.log('\n=== Results ===');
  console.log(JSON.stringify(results, null, 2));
  
  process.exit(0);
}

updateCards().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
