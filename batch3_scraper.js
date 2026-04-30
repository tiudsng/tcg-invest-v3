#!/usr/bin/env node
// batch3_scraper.js - Process cards 299-398 (100 cards from batch index 2, indices 0-99)
// Extract PSA10 prices and update Firebase

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Card data for batch 3 (from batch index 2, indices 0-99)
const cards = [
  { index: 0, doc_id: 'snkrdunk_93192', snkrdunk_id: '93192', name: 'Pikachu DPt-P 016/DPt-P' },
  { index: 1, doc_id: 'snkrdunk_435684', snkrdunk_id: '435684', name: 'Mewtwo LV.X :1ED PROMO DP5' },
  { index: 2, doc_id: 'snkrdunk_396642', snkrdunk_id: '396642', name: 'Ditto U SMP2 023/024' },
  { index: 3, doc_id: 'snkrdunk_431121', snkrdunk_id: '431121', name: 'Tyranitar :1ED e1 095/128' },
  { index: 4, doc_id: 'snkrdunk_111819', snkrdunk_id: '111819', name: 'Dark Typhlosion : Old Back neo4 No.157' },
  { index: 5, doc_id: 'snkrdunk_128260', snkrdunk_id: '128260', name: 'Articuno R: Master Ball Mirror SV2a 144/165' },
  { index: 6, doc_id: 'snkrdunk_332797', snkrdunk_id: '332797', name: 'Pawmi P SV-P 217' },
  { index: 7, doc_id: 'snkrdunk_92017', snkrdunk_id: '92017', name: 'Vileplume :1ED e1 100/128' },
  { index: 8, doc_id: 'snkrdunk_91156', snkrdunk_id: '91156', name: 'Charizard S8a-P 001/025' },
  { index: 9, doc_id: 'snkrdunk_96755', snkrdunk_id: '96755', name: 'Mewtwo V S10b 073/071' },
  { index: 10, doc_id: 'snkrdunk_91552', snkrdunk_id: '91552', name: 'Pikachu P BW-P 229/BW-P' },
  { index: 11, doc_id: 'snkrdunk_93071', snkrdunk_id: '93071', name: 'Pikachu SM-P 369' },
  { index: 12, doc_id: 'snkrdunk_332793', snkrdunk_id: '332793', name: 'Sprigatito P SV-P 213' },
  { index: 13, doc_id: 'snkrdunk_516415', snkrdunk_id: '516415', name: 'Pikachu V-UNION (Bottom Left) S8a 027/028' },
  { index: 14, doc_id: 'snkrdunk_128264', snkrdunk_id: '128264', name: 'Dragonite R: Master Ball Mirror SV2a 149/165' },
  { index: 15, doc_id: 'snkrdunk_450301', snkrdunk_id: '450301', name: 'Garchomp CLV.X :1ED Pt 007/016' },
  { index: 16, doc_id: 'snkrdunk_321540', snkrdunk_id: '321540', name: 'Mewtwo & Mew GX SM11 029/094' },
  { index: 17, doc_id: 'snkrdunk_93096', snkrdunk_id: '93096', name: 'Gengar & Mimikyu GX SR SM9 103/095' },
  { index: 18, doc_id: 'snkrdunk_93196', snkrdunk_id: '93196', name: 'Mew Pt-R 010/016' },
  { index: 19, doc_id: 'snkrdunk_459251', snkrdunk_id: '459251', name: 'Bayleef : Old Back PRMF-1 No.153' },
  { index: 20, doc_id: 'snkrdunk_92113', snkrdunk_id: '92113', name: 'Suicune : Old Back neo3 No.245' },
  { index: 21, doc_id: 'snkrdunk_128139', snkrdunk_id: '128139', name: 'Pidgey C: Master Ball Mirror SV2a 016/165' },
  { index: 22, doc_id: 'snkrdunk_379819', snkrdunk_id: '379819', name: 'M Blastoise EX XY1 015/060' },
  { index: 23, doc_id: 'snkrdunk_103043', snkrdunk_id: '103043', name: 'Mewtwo V s12a 050/172' },
  { index: 24, doc_id: 'snkrdunk_141676', snkrdunk_id: '141676', name: 'Raichu R s6a 027/069' },
  { index: 25, doc_id: 'snkrdunk_427860', snkrdunk_id: '427860', name: "Bugsy's Yanma :1ED VS 012/141" },
  { index: 26, doc_id: 'snkrdunk_128164', snkrdunk_id: '128164', name: 'Gloom U: Master Ball Mirror SV2a 044/165' },
  { index: 27, doc_id: 'snkrdunk_128183', snkrdunk_id: '128183', name: 'Abra C: Master Ball Mirror SV2a 063/165' },
  { index: 28, doc_id: 'snkrdunk_91252', snkrdunk_id: '91252', name: 'Pikachu SM-P 224' },
  { index: 29, doc_id: 'snkrdunk_407834', snkrdunk_id: '407834', name: 'Mew P SM-P 342' },
  { index: 30, doc_id: 'snkrdunk_96551', snkrdunk_id: '96551', name: 'Jolteon V S6a 078/069' },
  { index: 31, doc_id: 'snkrdunk_128083', snkrdunk_id: '128083', name: 'Ivysaur SV2a 167/165' },
  { index: 32, doc_id: 'snkrdunk_91352', snkrdunk_id: '91352', name: 'Charizard GX SM3H 058/051' },
  { index: 33, doc_id: 'snkrdunk_456139', snkrdunk_id: '456139', name: 'Goldeen : Old Back PMCG2 No.118' },
  { index: 34, doc_id: 'snkrdunk_128239', snkrdunk_id: '128239', name: 'Mr. Mime R: Master Ball Mirror SV2a 122/165' },
  { index: 35, doc_id: 'snkrdunk_397671', snkrdunk_id: '397671', name: 'Charmander S SM8b 166/150' },
  { index: 36, doc_id: 'snkrdunk_92146', snkrdunk_id: '92146', name: 'Articuno: Old Back PMCG-QS No.144' },
  { index: 37, doc_id: 'snkrdunk_91403', snkrdunk_id: '91403', name: 'Warm Pikachu XY-P 094/XY-P' },
  { index: 38, doc_id: 'snkrdunk_298872', snkrdunk_id: '298872', name: 'Pikachu : PROMO P S-P 024' },
  { index: 39, doc_id: 'snkrdunk_93379', snkrdunk_id: '93379', name: '骑拉帝纳 V' },
  { index: 40, doc_id: 'snkrdunk_93024', snkrdunk_id: '93024', name: 'Glaceon VMAX HR S6a 091/069' },
  { index: 41, doc_id: 'snkrdunk_128231', snkrdunk_id: '128231', name: 'Chansey R: Master Ball Mirror SV2a 113/165' },
  { index: 42, doc_id: 'snkrdunk_93279', snkrdunk_id: '93279', name: 'Articuno ex PCG1 036/082' },
  { index: 43, doc_id: 'snkrdunk_91503', snkrdunk_id: '91503', name: 'M Mewtwo EX SR :1ED XY8-R 063/059' },
  { index: 44, doc_id: 'snkrdunk_385399', snkrdunk_id: '385399', name: 'Gyarados R :1ED XY7 021/081' },
  { index: 45, doc_id: 'snkrdunk_91107', snkrdunk_id: '91107', name: 'Venusaur: Old Back/PROMO PMCG-P No.003' },
  { index: 46, doc_id: 'snkrdunk_91703', snkrdunk_id: '91703', name: 'Dragonite :1ED web 038/048' },
  { index: 47, doc_id: 'snkrdunk_457757', snkrdunk_id: '457757', name: 'Operation spy : Old Back PROMO PMCG-GYM2' },
  { index: 48, doc_id: 'snkrdunk_147546', snkrdunk_id: '147546', name: "Rocket's Admin CLF 031/032" },
  { index: 49, doc_id: 'snkrdunk_415566', snkrdunk_id: '415566', name: 'Victini P BW-P 234/BW-P' },
  { index: 50, doc_id: 'snkrdunk_93079', snkrdunk_id: '93079', name: 'Pikachu SM-P 276' },
  { index: 51, doc_id: 'snkrdunk_111815', snkrdunk_id: '111815', name: "Pryce's Lapras :1ED VS 041/141" },
  { index: 52, doc_id: 'snkrdunk_452573', snkrdunk_id: '452573', name: 'Mew P e-P 033' },
  { index: 53, doc_id: 'snkrdunk_128131', snkrdunk_id: '128131', name: 'Squirtle C: Master Ball Mirror SV2a 007/165' },
  { index: 54, doc_id: 'snkrdunk_411720', snkrdunk_id: '411720', name: 'Pikachu P XY-P 064' },
  { index: 55, doc_id: 'snkrdunk_407861', snkrdunk_id: '407861', name: 'Pikachu P SM-P 377' },
  { index: 56, doc_id: 'snkrdunk_106332', snkrdunk_id: '106332', name: 'Ninetales BREAK RR :1ED CP6 016/087' },
  { index: 57, doc_id: 'snkrdunk_459259', snkrdunk_id: '459259', name: 'Entei LV.37 : Old Back PRMF-2 No.244' },
  { index: 58, doc_id: 'snkrdunk_128135', snkrdunk_id: '128135', name: 'Butterfree U: Master Ball Mirror SV2a 012/165' },
  { index: 59, doc_id: 'snkrdunk_454943', snkrdunk_id: '454943', name: 'Lapras : Old Back PMCG-Red No.131' },
  { index: 60, doc_id: 'snkrdunk_457802', snkrdunk_id: '457802', name: "Sabrina's Abra LV.12 : Old Back PMCG-GYM3 No.063" },
  { index: 61, doc_id: 'snkrdunk_141891', snkrdunk_id: '141891', name: 'Gengar R s6K 027/070' },
  { index: 62, doc_id: 'snkrdunk_111811', snkrdunk_id: '111811', name: "Erika's Bellossom :1ED VS 059/141" },
  { index: 63, doc_id: 'snkrdunk_385895', snkrdunk_id: '385895', name: 'M Alakazam EX XY 041/171' },
  { index: 64, doc_id: 'snkrdunk_334019', snkrdunk_id: '334019', name: 'Pikachu : PROMO P S-P 125' },
  { index: 65, doc_id: 'snkrdunk_389557', snkrdunk_id: '389557', name: 'Mew R :1ED XY10 027/078' },
  { index: 66, doc_id: 'snkrdunk_95318', snkrdunk_id: '95318', name: 'Aroma Lady S6a 086/069' },
  { index: 67, doc_id: 'snkrdunk_172043', snkrdunk_id: '172043', name: 'Dragonite EX P Promo Card Pack) SV-P 134' },
  { index: 68, doc_id: 'snkrdunk_110873', snkrdunk_id: '110873', name: 'Dark Weezing :1ED web 021/048' },
  { index: 69, doc_id: 'snkrdunk_429133', snkrdunk_id: '429133', name: 'Ivysaur :1ED e 003/029' },
  { index: 70, doc_id: 'snkrdunk_387059', snkrdunk_id: '387059', name: 'Gengar & Mimikyu GX SM9 038/095' },
  { index: 71, doc_id: 'snkrdunk_108465', snkrdunk_id: '108465', name: 'Dragonite EX SR :1ED XY3 100/096' },
  { index: 72, doc_id: 'snkrdunk_128268', snkrdunk_id: '128268', name: 'Antique Helix Fossil C: Master Ball Mirror SV2a 154/165' },
  { index: 73, doc_id: 'snkrdunk_127808', snkrdunk_id: '127808', name: 'Pikachu C SV2a 025/165' },
  { index: 74, doc_id: 'snkrdunk_128235', snkrdunk_id: '128235', name: 'Goldeen C: Master Ball Mirror SV2a 118/165' },
  { index: 75, doc_id: 'snkrdunk_107450', snkrdunk_id: '107450', name: 'Pikachu SM-P 200' },
  { index: 76, doc_id: 'snkrdunk_91103', snkrdunk_id: '91103', name: 'Charizard VMAX HR S-P 104' },
  { index: 77, doc_id: 'snkrdunk_92042', snkrdunk_id: '92042', name: 'Pidgeot :1ED e1 123/128' },
  { index: 78, doc_id: 'snkrdunk_91507', snkrdunk_id: '91507', name: 'M Mewtwo EX SR :1ED XY8-B 063/059' },
  { index: 79, doc_id: 'snkrdunk_91407', snkrdunk_id: '91407', name: 'Pikachu XY-P 090/XY-P' },
  { index: 80, doc_id: 'snkrdunk_92142', snkrdunk_id: '92142', name: "Erika's Venusaur R: Old Back PMCG-G2 No.003" },
  { index: 81, doc_id: 'snkrdunk_96550', snkrdunk_id: '96550', name: 'Espeon V S6a 080/069' },
  { index: 82, doc_id: 'snkrdunk_331669', snkrdunk_id: '331669', name: 'Pikachu V S8a-G 005/015' },
  { index: 83, doc_id: 'snkrdunk_457703', snkrdunk_id: '457703', name: "Misty's Goldeen LV.8 : Old Back PMCG-GYM1 No.118" },
  { index: 84, doc_id: 'snkrdunk_128082', snkrdunk_id: '128082', name: 'Bulbasaur SV2a 166/165' },
  { index: 85, doc_id: 'snkrdunk_456138', snkrdunk_id: '456138', name: 'Flareon : Old Back PMCG2 No.136' },
  { index: 86, doc_id: 'snkrdunk_334710', snkrdunk_id: '334710', name: 'Pikachu C SM3N 013/051' },
  { index: 87, doc_id: 'snkrdunk_128238', snkrdunk_id: '128238', name: 'Starmie R: Master Ball Mirror SV2a 121/165' },
  { index: 88, doc_id: 'snkrdunk_141273', snkrdunk_id: '141273', name: 'Galarian Articuno V s8b 230/184' },
  { index: 89, doc_id: 'snkrdunk_91806', snkrdunk_id: '91806', name: 'Gengar ex PCG1 048/082' },
  { index: 90, doc_id: 'snkrdunk_128182', snkrdunk_id: '128182', name: 'Poliwrath U: Master Ball Mirror SV2a 062/165' },
  { index: 91, doc_id: 'snkrdunk_91657', snkrdunk_id: '91657', name: 'Pikachu L-P 019/L-P' },
  { index: 92, doc_id: 'snkrdunk_92112', snkrdunk_id: '92112', name: 'Ho-Oh : Old Back neo3 No.250' },
  { index: 93, doc_id: 'snkrdunk_110091', snkrdunk_id: '110091', name: 'Gyarados R PCG2 024/082' },
  { index: 94, doc_id: 'snkrdunk_385898', snkrdunk_id: '385898', name: 'Mew XY 044/171' },
  { index: 95, doc_id: 'snkrdunk_592176', snkrdunk_id: '592176', name: 'Mew ex P SV-P 003' },
  { index: 96, doc_id: 'snkrdunk_128138', snkrdunk_id: '128138', name: 'Beedrill R: Master Ball Mirror SV2a 015/165' },
  { index: 97, doc_id: 'snkrdunk_379818', snkrdunk_id: '379818', name: 'M Blastoise EX RR :1ED XY1 015/060' },
  { index: 98, doc_id: 'snkrdunk_377912', snkrdunk_id: '377912', name: 'Blastoise VMAX SEK 002/020' },
  { index: 99, doc_id: 'snkrdunk_516414', snkrdunk_id: '516414', name: 'Pikachu V-UNION (Top Right) S8a 026/028' }
];

const BASE_URL = 'https://snkrdunk.com/en/trading-cards';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateFirebase(docId, price) {
  const productRef = doc(db, 'products', docId);
  const now = new Date().toISOString();
  
  const productUpdate = {
    market_data: {
      psa10_price: price,
      last_updated: now
    },
    updatedBy: 'batch_scrape',
    last_history_sync: now
  };

  try {
    await setDoc(productRef, productUpdate, { merge: true });
    const historyRef = collection(productRef, 'price_history');
    await addDoc(historyRef, {
      psa10_price: price,
      raw_price: null,
      source: 'scraper',
      createdAt: serverTimestamp()
    });
    return { success: true, price };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function processCard(card) {
  const { index, doc_id, snkrdunk_id, name } = card;
  const url = `${BASE_URL}/${snkrdunk_id}/used`;
  
  console.log(`[${index}] Fetching ${snkrdunk_id}...`);
  
  // We need to use browser for this. This script runs outside browser context.
  // For batch processing, we should do this via browser automation.
  // This is a placeholder - actual processing will be done via browser.
  return { index, doc_id, snkrdunk_id, name, price: null, status: 'pending' };
}

// Note: This script is a helper. Actual scraping is done via browser tools.
// This file documents the card list for reference during manual browser scraping.

console.log(`Batch 3 cards: ${cards.length} cards (indices 0-99 from batch 2)`);
console.log('Use browser to navigate to each card page, click PSA10, extract price, then run batch3_update.js with results.');
console.log('\nCard list:');
cards.forEach(c => console.log(`  ${c.index}: ${c.snkrdunk_id} (${c.name})`));