import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

async function runSeed() {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Config file not found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: config.projectId
    });
  }

  const db = getFirestore(admin.app(), config.firestoreDatabaseId);

  const leaderboardData = [
    {
      card_id: 'charizard_151_sar',
      rank: 1,
      name_zh: '噴火龍 ex (151 SAR)',
      name_jp: 'リザードンex',
      card_number: '201/165',
      set_name: 'SV2a 151',
      image_url: 'https://images.pokemoncard.io/cards/sv2a/201.png',
      market_data: { snkrdunk_price: 12500, ebay_price: 12500, change_24h: '+2.4%', status: 'up' }
    },
    {
      card_id: 'van_gogh_pikachu',
      rank: 2,
      name_zh: '梵高皮卡丘 (Promo)',
      name_jp: 'ゴッホ ピカチュウ',
      card_number: '085/SVP',
      set_name: 'Promo',
      image_url: 'https://images.pokemoncard.io/cards/svp/85.png',
      market_data: { snkrdunk_price: 8800, ebay_price: 8800, change_24h: '+5.1%', status: 'up' }
    },
    {
      card_id: 'mew_151_sar',
      rank: 3,
      name_zh: '夢幻 ex (泡泡 SAR)',
      name_jp: 'ミュウex',
      card_number: '205/165',
      set_name: 'SV2a 151',
      image_url: 'https://images.pokemoncard.io/cards/sv2a/205.png',
      market_data: { snkrdunk_price: 7200, ebay_price: 7200, change_24h: '+1.2%', status: 'up' }
    },
    {
      card_id: 'mewtwo_armor',
      rank: 4,
      name_zh: '武裝夢夢 (特典)',
      name_jp: 'アーマードミュウツー',
      card_number: '365/SM-P',
      set_name: 'SM-P Promo',
      image_url: 'https://images.pokemoncard.io/cards/smp/365.png',
      market_data: { snkrdunk_price: 4500, ebay_price: 4500, change_24h: '0.0%', status: 'stable' }
    },
    {
      card_id: 'umbreon_vmax_sa',
      rank: 5,
      name_zh: '月亮伊布 VMAX (SA)',
      name_jp: 'ブラッキーVMAX',
      card_number: '095/069',
      set_name: 'S6a Eevee Heroes',
      image_url: 'https://images.pokemoncard.io/cards/s6a/95.png',
      market_data: { snkrdunk_price: 18500, ebay_price: 18500, change_24h: '+0.5%', status: 'up' }
    },
    {
      card_id: 'lillie_determination_sv9',
      rank: 6,
      name_zh: '莉莉艾的決意 (Mega 2026)',
      name_jp: 'リーリエの全力',
      card_number: 'SV9 SAR',
      set_name: 'SV9',
      image_url: 'https://placehold.co/400x560/f8d7da/721c24?text=Lillie+SV9',
      market_data: { snkrdunk_price: 5800, ebay_price: 5800, change_24h: '+12.4%', status: 'up' }
    },
    {
      card_id: 'pikachu_ex_sv8a',
      rank: 7,
      name_zh: '皮卡丘 ex (超電突波 UR)',
      name_jp: 'ピカチュウex',
      card_number: '236/187',
      set_name: 'SV8a',
      image_url: 'https://images.pokemoncard.io/cards/sv8a/236.png',
      market_data: { snkrdunk_price: 3200, ebay_price: 3200, change_24h: '-2.1%', status: 'down' }
    },
    {
      card_id: 'gengar_masterball',
      rank: 8,
      name_zh: '耿鬼 (151 大師球閃)',
      name_jp: 'ゲンガー',
      card_number: '094/165',
      set_name: 'SV2a 151',
      image_url: 'https://images.pokemoncard.io/cards/sv2a/94.png',
      market_data: { snkrdunk_price: 2800, ebay_price: 2800, change_24h: '+1.8%', status: 'up' }
    },
    {
      card_id: 'ion_sar',
      rank: 9,
      name_zh: '奇樹 (SAR)',
      name_jp: 'ナンジャモ',
      card_number: '357/190',
      set_name: 'SV4a',
      image_url: 'https://images.pokemoncard.io/cards/sv4a/357.png',
      market_data: { snkrdunk_price: 1900, ebay_price: 1900, change_24h: '-0.5%', status: 'down' }
    },
    {
      card_id: 'charizard_y_sv9',
      rank: 10,
      name_zh: 'Mega 噴火龍 Y ex (SAR)',
      name_jp: 'メガリザードンY',
      card_number: 'SV9',
      set_name: 'SV9',
      image_url: 'https://placehold.co/400x560/1c1c1e/d4af37?text=Charizard+Y+SV9',
      market_data: { snkrdunk_price: 9500, ebay_price: 9500, change_24h: '+15.0%', status: 'up' }
    }
  ];

  const colRef = db.collection('list_1');
  
  // Clear
  console.log("Cleaning collection...");
  const snapshot = await colRef.get();
  const batchSize = 100;
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // Add
  console.log("Adding items...");
  for (const item of leaderboardData) {
    await colRef.doc(item.card_id).set(item);
    console.log(`- ${item.name_zh}`);
  }
  
  console.log("Success!");
}

runSeed().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});
