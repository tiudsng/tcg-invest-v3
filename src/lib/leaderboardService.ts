import { collection, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updateProductPrice } from './priceService.js';
import { db } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import { scrapeSnkrdunkMarketStats, scrapePSAPopulation, scrapePokecaChartAdvancedData } from './snkrdunkSearchService.js';

export const baselineData = [
  {
    id: 'rank_01',
    card_id: 'snkrdunk_146897',
    rank: 1,
    name_zh: '梵谷皮卡丘 SVP 085',
    name_hk: '梵谷皮卡丘',
    name_jp: 'van_gogh_pikachu',
    card_number: '085/SVP',
    set_name: 'Promo',
    image_url: 'https://cdn.snkrdunk.com/upload_bg_removed/20240221105626-0.webp',
    market_data: { psa10_price: 28000, raw_price: 6200, snkrdunk_price: 28000, ebay_price: 28000, change_24h: '+5.1%', status: 'up' }
  },
  {
    id: 'rank_02',
    card_id: 'snkrdunk_93021',
    rank: 2,
    name_zh: '月亮伊布 VMAX HR (SA) S6a 095/069',
    name_hk: '月亮伊布 VMAX (SA)',
    name_jp: 'ブラッキーVMAX',
    card_number: '095/069',
    set_name: 'Eevee Heroes',
    image_url: 'https://pokeca-chart.com/wp-content/uploads/2021/05/043000_P_BURAKKI-VMAX-733x1024.jpg',
    market_data: { psa10_price: 43532, raw_price: 24804, snkrdunk_price: 43532, ebay_price: 28000, change_24h: '+5.1%', status: 'up' }
  },
  {
    id: 'rank_03',
    card_id: 'snkrdunk_107574',
    rank: 3,
    name_zh: '盔甲超夢 (Armored Mewtwo) SM-P',
    name_hk: '盔甲超夢',
    name_jp: 'Armored Mewtwo',
    card_number: '365/SM-P',
    set_name: 'SM-P Promo',
    image_url: 'https://pokeca-chart.com/wp-content/uploads/2019/06/036987_P_AMADOMYUUTSU.jpg',
    market_data: { psa10_price: 9259, raw_price: 569, snkrdunk_price: 9259, ebay_price: 9259, change_24h: '0.0%', status: 'stable' }
  },
  {
    id: 'rank_04',
    card_id: 'snkrdunk_724996',
    rank: 4,
    name_zh: 'MEGA Gengar ex SAR SV9 109/080',
    name_hk: '耿鬼 ex SAR',
    name_jp: 'MEGA Gengar ex SAR',
    card_number: '109/080',
    set_name: 'SV9',
    image_url: 'https://pokeca-chart.com/wp-content/uploads/2025/11/050000_P_MGENGAEX-733x1024.jpg',
    market_data: { psa10_price: 3200, raw_price: 950, snkrdunk_price: 3200, ebay_price: 3200, change_24h: '+5.0%', status: 'up' }
  },
  {
    id: 'rank_05',
    card_id: 'snkrdunk_704401',
    rank: 5,
    name_zh: 'MEGA Charizard X ex SAR SV9 107/080',
    name_hk: '噴火龍 X ex SAR',
    name_jp: 'MEGA Charizard X ex SAR',
    card_number: '107/080',
    set_name: 'SV9',
    image_url: 'https://pokeca-chart.com/wp-content/uploads/2025/09/048516_P_MRIZADONXEX-733x1024.jpg',
    market_data: { psa10_price: 3500, raw_price: 1100, snkrdunk_price: 3500, ebay_price: 3500, change_24h: '+4.2%', status: 'up' }
  },
  {
    id: 'rank_06',
    card_id: 'snkrdunk_164250',
    rank: 6,
    name_zh: 'Mew ex SV4a 347/190',
    name_jp: 'ミュウex SAR',
    card_number: '347/190',
    set_name: 'Shiny Treasure ex',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    market_data: { psa10_price: 1200, raw_price: 650, snkrdunk_price: 1200, ebay_price: 1200, change_24h: '+0.8%', status: 'up' }
  },
  {
    id: 'rank_07',
    card_id: 'snkrdunk_128117',
    rank: 7,
    name_zh: 'Charizard ex SV2a 201/165',
    name_hk: '噴火龍 151',
    name_jp: 'Charizard ex SAR',
    card_number: '201/165',
    set_name: 'SV2a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043986_P_RIZADONEX.jpg',
    market_data: { psa10_price: 12800, raw_price: 4500, snkrdunk_price: 12800, ebay_price: 13500, change_24h: '+2.4%', status: 'up' }
  },
  {
    id: 'rank_08',
    card_id: 'snkrdunk_91323',
    rank: 8,
    name_zh: '莉莉艾 SAR SV5a',
    name_jp: 'Lillie SAR',
    card_number: '191/170',
    set_name: 'SV5a',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV5A/191.png',
    market_data: { psa10_price: 38500, raw_price: 12000, snkrdunk_price: 38500, ebay_price: 38500, change_24h: '+12.4%', status: 'up' }
  },
  {
    id: 'rank_09',
    card_id: 'snkrdunk_469638',
    rank: 9,
    name_zh: '皮卡丘 ex UR SV8a',
    name_jp: 'Pikachu ex UR',
    card_number: '236/187',
    set_name: 'SV8a',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV8A/236.png',
    market_data: { psa10_price: 3200, raw_price: 950, snkrdunk_price: 3200, ebay_price: 3200, change_24h: '+5.0%', status: 'up' }
  },
  {
    id: 'rank_10',
    card_id: 'snkrdunk_186243',
    rank: 10,
    name_zh: '耿鬼 ex SAR SV9 109',
    name_jp: 'Gengar ex SAR',
    card_number: '109/090',
    set_name: 'SV9',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV9/109.png',
    market_data: { psa10_price: 3200, raw_price: 950, snkrdunk_price: 3200, ebay_price: 3200, change_24h: '+5.0%', status: 'up' }
  }
];

const defaultMappings: Record<string, string> = {
  'rank_01': 'snkrdunk_146897',
  'rank_02': 'snkrdunk_93021',
  'rank_03': 'snkrdunk_107574',
  'rank_04': 'snkrdunk_724996',
  'rank_05': 'snkrdunk_704401',
  'rank_06': 'snkrdunk_164250',
  'rank_07': 'snkrdunk_128117',
  'rank_08': 'snkrdunk_91323',
  'rank_09': 'snkrdunk_469638',
  'rank_10': 'snkrdunk_186243'
};

export async function syncLeaderboard(onProgress?: (msg: string) => void, dbOverride?: any, apiKeyOverride?: string) {
  const targetDb = dbOverride || db;
  const rawKey = apiKeyOverride || process.env.GEMINI_API_KEY || '';
  const cleanKey = String(rawKey).replace(/['"]/g, '').trim();

  let activeMappings: Record<string, string> = { ...defaultMappings };
  try {
    const configSnap = await (targetDb.doc ? targetDb.doc('config/leaderboard').get() : getDoc(doc(targetDb, 'config', 'leaderboard')));
    if (configSnap.exists && (typeof configSnap.exists === 'function' ? configSnap.exists() : true)) {
      const configData = configSnap.data();
      if (configData.rankings && Array.isArray(configData.rankings)) {
        activeMappings = {};
        configData.rankings.forEach((snkrdunkId: string, index: number) => {
          const rankKey = `rank_${(index + 1).toString().padStart(2, '0')}`;
          activeMappings[rankKey] = snkrdunkId;
        });
      }
    }
  } catch (err) {
    console.warn("Failed to load leaderboard config.");
  }

  if (onProgress) onProgress(`已加載排行榜配置，共 ${Object.keys(activeMappings).length} 個項目`);

  const querySnapshot = await (targetDb.collection ? targetDb.collection('leaderboard').get() : getDocs(collection(targetDb, 'leaderboard')));
  
  let ai = null;
  if (cleanKey) {
    ai = new GoogleGenAI({ apiKey: cleanKey });
  }
  let currentItems = querySnapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));

  const workItems = await Promise.all(Object.entries(activeMappings).map(async ([rankKey, forceCardId]) => {
    if (onProgress) onProgress(`正在準備: ${rankKey} -> ${forceCardId}`);
    const existing: any = currentItems.find(curr => curr.id === rankKey);
    const rankNum = parseInt(rankKey.split('_')[1]);
    const baseTemplate = baselineData.find(b => b.id === rankKey) || baselineData[0];
    
    let cardInfo: any = { id: rankKey, rank: rankNum, card_id: forceCardId };
    
    // Only inherit baseline metadata if the card matches the baseline default
    if (baseTemplate.card_id === forceCardId) {
      cardInfo = { ...baseTemplate, ...cardInfo };
    }

    if (forceCardId) {
      try {
        let productData: any = null;
        let productSnap = await (targetDb.doc ? targetDb.doc(`products/${forceCardId}`).get() : getDoc(doc(targetDb, 'products', forceCardId)));
        
        let hasData = (typeof productSnap.exists === 'function') ? productSnap.exists() : productSnap.exists;
        
        // If not found, try adding snkrdunk_ prefix as fallback
        if (!hasData && !forceCardId.startsWith('snkrdunk_')) {
          productSnap = await (targetDb.doc ? targetDb.doc(`products/snkrdunk_${forceCardId}`).get() : getDoc(doc(targetDb, 'products', `snkrdunk_${forceCardId}`)));
          hasData = (typeof productSnap.exists === 'function') ? productSnap.exists() : productSnap.exists;
        }

        if (hasData) {
          productData = productSnap.data();
        }

        if (hasData && productData) {
          if (productData.name) cardInfo.name = productData.name;
          if (productData.name_zh) cardInfo.name_zh = productData.name_zh;
          if (productData.name_hk) cardInfo.name_hk = productData.name_hk;
          if (productData.name_jp) cardInfo.name_jp = productData.name_jp;
          if (productData.card_number) cardInfo.card_number = productData.card_number;
          if (productData.set_code && !productData.card_number) cardInfo.card_number = productData.set_code;
          if (productData.set_name) cardInfo.set_name = productData.set_name;
          if (productData.market_data) cardInfo.market_data = productData.market_data;
          
          if (productData.image_url) {
             cardInfo.image_url = productData.image_url;
          } else {
            // Auto-assign Firebase Storage URL as fallback
            const bucket = 'gen-lang-client-0326385388.firebasestorage.app';
            let autoImgId = forceCardId;
            if (hasData && productSnap && productSnap.id) {
                autoImgId = productSnap.id;
            } else if (productData && productData.snkrdunk_id && !autoImgId.startsWith('snkrdunk_')) {
              autoImgId = `snkrdunk_${productData.snkrdunk_id}`;
            }
            cardInfo.image_url = `https://storage.googleapis.com/${bucket}/card_images/${autoImgId}.webp`;
          }
        } else {
            // Fallback for baseline items not in products collection
            const bucket = 'gen-lang-client-0326385388.firebasestorage.app';
            cardInfo.image_url = `https://storage.googleapis.com/${bucket}/card_images/${forceCardId}.webp`;
        }

      } catch (err) {
        console.error(`Error fetching product data for ${forceCardId}:`, err);
      }
    }

    return { ...(existing || {}), ...cardInfo };
  }));

  // Process in batches to balance speed and reliability
  for (let i = 0; i < workItems.length; i += 5) {
    const batch = workItems.slice(i, i + 5);
    const syncPromises = batch.map(async (item: any) => {
      let finalData: any = { ...item, updatedBy: 'bot' };
      let scrapedText = "";

      const rawId = item.card_id?.replace('snkrdunk_', '');

      if (onProgress) onProgress(`正在同步 NO.${item.rank}: ${item.name_zh || item.card_id}`);
      
      // Direct Scraping in the service
      if (rawId) {
        try {
          const stats = await scrapeSnkrdunkMarketStats(item.card_id);
          scrapedText = JSON.stringify(stats);
          
          const rateMap: Record<string, number> = { "US $": 150, "SG $": 110, "¥": 1 };
          const cur = stats.currency.trim();
          const conversionRate = rateMap[cur] || 150;
          const JPY_TO_HKD = 0.052;
          
          const m = { ...(finalData.market_data || {}) };

          if (stats.median_sold_psa10) {
            const psa10_jpy = Math.round(stats.median_sold_psa10 * conversionRate);
            const hkd = Math.round(psa10_jpy * JPY_TO_HKD);
            m.psa10_price = hkd;
            m.snkrdunk_price = hkd;
            m.last_psa10_jpy = psa10_jpy;
            m.sync_method = stats.method || 'puppet_psa10_filter';
            m.updatedAt = new Date().toISOString();
          }

          if (stats.median_sold_raw) {
            const raw_jpy = Math.round(stats.median_sold_raw * conversionRate);
            m.raw_price = Math.round(raw_jpy * JPY_TO_HKD);
            m.last_raw_jpy = raw_jpy;
          }

          // Try population scrape if not updated recently
          if (item.card_number) {
            try {
              const pop = await scrapePSAPopulation(item.card_number);
              if (pop) {
                m.psa_pop_total = pop.total;
                m.psa10_population = pop.psa10;
                m.psa_pop_10 = pop.psa10;
                if (pop.total > 0) {
                  m.psa_pop_10_percent = ((pop.psa10 / pop.total) * 100).toFixed(1) + '%';
                }
                m.last_pop_sync = new Date().toISOString();
              }
            } catch (popErr) {
              console.warn(`Population scrape failed for ${item.card_number}:`, popErr);
            }
          }

          // Try advanced PokecaChart data sync
          const extractedSetCode = item.set_code || (item.set_name ? item.set_name.split(' ')[0] : null);
          if (extractedSetCode && item.card_number) {
            try {
              const setIdStr = `${extractedSetCode}-${item.card_number.replace('/', '-')}`;
              const pData = await scrapePokecaChartAdvancedData(setIdStr);
              
              if (pData) {
                finalData.pokeca_chart_data = pData;
                m.pokeca_chart_sync = new Date().toISOString();
                
                // Override raw and PSA 10 metrics with the real chart ones if found
                const JPY_TO_HKD_LOCAL = 0.052;
                if (pData.stats?.raw?.latest_price) {
                  const jpy = parseInt(pData.stats.raw.latest_price.replace(/[^\d]/g, ''), 10);
                  if (!isNaN(jpy)) m.raw_price = Math.round(jpy * JPY_TO_HKD_LOCAL);
                }
                if (pData.stats?.psa10?.latest_price) {
                  const jpy = parseInt(pData.stats.psa10.latest_price.replace(/[^\d]/g, ''), 10);
                  if (!isNaN(jpy)) {
                    m.psa10_price = Math.round(jpy * JPY_TO_HKD_LOCAL);
                    m.snkrdunk_price = m.psa10_price;
                    m.last_psa10_jpy = jpy;
                  }
                }
              }
            } catch (pErr) {
              console.warn(`PokecaChart sync failed for ${item.card_id}:`, pErr);
            }
          }

          finalData.market_data = m;
          if (onProgress && m.psa10_price) onProgress(`[Scrape] ${item.id} PSA10: HK$${m.psa10_price}`);
        } catch (err) {
          console.warn(`Direct scraping failed for ${rawId}:`, err);
        }
      }

      try {
        const prompt = `Task: Analyze Pokémon card market.
        Card: "${item.name_zh}" (${item.card_number})
        
        Mandatory JSON Output:
        {
          "analysis_quote": "Chinese string",
          "growth_potential": 0-100,
          "holding_advice": "Chinese string",
          "holding_score": 0-100
        }`;

        if (ai && scrapedText) {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt + "\nContext: " + scrapedText.substring(0, 3000)
          });
          const aiText = response.text || "";
          const aiResult = JSON.parse(aiText.replace(/```json|```/g, '') || '{}');
          
          if (aiResult.analysis_quote) {
            finalData.analysis_quote = aiResult.analysis_quote;
            finalData.investment_metrics = {
              growth_potential: aiResult.growth_potential,
              holding_advice: aiResult.holding_advice,
              holding_score: aiResult.holding_score
            };
          }
        } else if (!ai && scrapedText) {
          finalData.last_ai_status = 'skipped_no_key';
        }
      } catch (e: any) {
        let msg = e.message || 'unknown error';
        if (msg.includes('API key not valid')) {
          msg = 'Gemini API Key format is invalid (400 INVALID_ARGUMENT). Please check your key settings.';
        } else if (msg.includes('Your prepayment credits are depleted')) {
          msg = 'API Key is out of credits (429 RESOURCE_EXHAUSTED). Please check billing.';
        } else if (msg.includes('404')) {
          msg = 'Gemini model unavailable (404 NOT FOUND). Please check model name.';
        }
        console.warn(`[SyncService] Analysis failed for item ${item.id}: ${msg}`);
        finalData.last_ai_status = 'failed';
        finalData.last_ai_error = msg;
      }

      // Ensure core data doesn't get accidentally dropped
      if (!finalData.name_zh || !finalData.rank || !finalData.image_url) {
        finalData.name_zh = finalData.name_zh || item.name_zh || item.name;
        finalData.rank = finalData.rank || item.rank;
        finalData.card_id = finalData.card_id || item.card_id;
        finalData.image_url = finalData.image_url || item.image_url;
        finalData.set_name = finalData.set_name || item.set_name;
        finalData.set_code = finalData.set_code || item.set_code;
        finalData.card_number = finalData.card_number || item.card_number;
      }


      // Clean up undefined fields
      Object.keys(finalData).forEach(key => {
        if (finalData[key] === undefined) {
          delete finalData[key];
        }
      });

      // Final persistence
      if (targetDb.doc) {
        // Record price history if any price data exists
        if (finalData.market_data?.psa10_price || finalData.market_data?.raw_price) {
          try {
            await updateProductPrice(item.card_id, {
              psa10_price: finalData.market_data.psa10_price,
              raw_price: finalData.market_data.raw_price,
              source: 'scraper'
            }, targetDb);
          } catch (e) {
            console.warn(`[SyncService] Failed to record history for ${item.card_id} in leaderboard sync:`, e);
          }
        }
        await targetDb.doc(`leaderboard/${item.id}`).set(finalData);
      } else {
        if (finalData.market_data?.psa10_price || finalData.market_data?.raw_price) {
          try {
            await updateProductPrice(item.card_id, {
              psa10_price: finalData.market_data.psa10_price,
              raw_price: finalData.market_data.raw_price,
              source: 'scraper'
            }, targetDb);
          } catch (e) {}
        }
        await setDoc(doc(targetDb, 'leaderboard', item.id), finalData);
      }
    });

    await Promise.all(syncPromises);
  }
  return true;
}

export async function syncSingleCard(rankKey: string, cardId: string, dbOverride?: any, apiKeyOverride?: string) {
  const targetDb = dbOverride || db;
  const rawKey = apiKeyOverride || process.env.GEMINI_API_KEY || '';
  const cleanKey = String(rawKey).replace(/['"]/g, '').trim();

  let ai = null;
  if (cleanKey) {
    ai = new GoogleGenAI({ apiKey: cleanKey });
  }
  
  // Fetch existing or baseline
  let existingData: any = {};
  try {
    const snap = await (targetDb.doc ? targetDb.doc(`leaderboard/${rankKey}`).get() : getDoc(doc(targetDb, 'leaderboard', rankKey)));
    if (snap.exists && (typeof snap.exists === 'function' ? snap.exists() : snap.exists)) {
       existingData = snap.data ? snap.data() : snap.data;
    }
  } catch(e) {}

  const rankNum = parseInt(rankKey.split('_')[1]);
  const baseTemplate = baselineData.find(b => b.id === rankKey) || baselineData[0];
  
  // If the card_id has changed for this rank, we shouldn't inherit the old card's names/images
  if (existingData.card_id && existingData.card_id !== cardId) {
    existingData = { 
      market_data: {} 
    }; // keep it mostly empty so we don't mix up card names
  }

  // Only inherit baseline metadata if the card matches the baseline default for this slot
  const cleanBase = (baseTemplate.card_id === cardId) ? baseTemplate : { id: rankKey, rank: rankNum, card_id: cardId };

  let finalData: any = { ...cleanBase, ...existingData, id: rankKey, rank: rankNum, card_id: cardId, updatedBy: 'bot' };

  // Fetch product meta
  try {
    const pSnap = await (targetDb.doc ? targetDb.doc(`products/${cardId}`).get() : getDoc(doc(targetDb, 'products', cardId)));
    if (pSnap.exists && (typeof pSnap.exists === 'function' ? pSnap.exists() : pSnap.exists)) {
      const p = pSnap.data ? pSnap.data() : pSnap.data;
      if (p) {
        finalData = { 
          ...finalData, 
          name_zh: p.name_zh || p.name || finalData.name_zh,
          name_en: p.name_en || p.name || finalData.name_en, // Added name_en
          name_hk: p.name_hk || finalData.name_hk, // Added name_hk
          name_jp: p.name_jp || finalData.name_jp, 
          card_number: p.card_number || finalData.card_number, 
          set_name: p.set_name || finalData.set_name, 
          set_code: p.set_code || finalData.set_code, // Added set_code
          image_url: p.image_url || finalData.image_url 
        };
      }
    }
  } catch(e) {
    console.error(`Error fetching product ${cardId}:`, e);
  }

  // --- STEP 1: BROWSING & DATA EXTRACTION ---
  let scrapedText = "";
  const snkrId = cardId.replace('snkrdunk_', '');
  
  const stats = await scrapeSnkrdunkMarketStats(cardId);
  const rateMap: Record<string, number> = { "US $": 150, "SG $": 110, "¥": 1 };
  const cur = stats.currency.trim();
  const conversionRate = rateMap[cur] || 150;
  let psa10_jpy = stats.median_sold_psa10 ? Math.round(stats.median_sold_psa10 * conversionRate) : null;
  let raw_jpy = stats.median_sold_raw ? Math.round(stats.median_sold_raw * conversionRate) : null;
  
  scrapedText = JSON.stringify(stats);

  const JPY_TO_HKD = 0.052;
  const m = { ...(finalData.market_data || {}) };
  
  if (psa10_jpy && psa10_jpy > 0) {
    const hkd = Math.round(psa10_jpy * JPY_TO_HKD);
    m.psa10_price = hkd;
    m.snkrdunk_price = hkd;
    m.last_psa10_jpy = psa10_jpy;
    console.log(`[SyncService] FOUND PRICE: PSA10 JPY=${psa10_jpy} -> HK$${hkd}`);
  } else {
    console.warn(`[SyncService] MISSING PRICE: PSA10 not found. Stats:`, stats);
  }

  if (raw_jpy && raw_jpy > 0) {
    m.raw_price = Math.round((raw_jpy as number) * JPY_TO_HKD);
    m.last_raw_jpy = raw_jpy;
  }
  
  // Try population scrape if not updated recently
  if (finalData.card_number) {
    try {
      const pop = await scrapePSAPopulation(finalData.card_number);
      if (pop) {
        m.psa_pop_total = pop.total;
        m.psa10_population = pop.psa10;
        m.psa_pop_10 = pop.psa10;
        m.psa_pop_9 = pop.psa9;
        m.psa_pop_8 = pop.psa8;
        if (pop.total > 0) {
          m.psa_pop_10_percent = ((pop.psa10 / pop.total) * 100).toFixed(1) + '%';
        }
        m.last_pop_sync = new Date().toISOString();
      }

      // Try advanced PokecaChart data sync
      const extractedSetCode = finalData.set_code || (finalData.set_name && finalData.set_name.includes(' ') ? finalData.set_name.split(' ')[0] : finalData.set_name);
      if (extractedSetCode && finalData.card_number) {
        // Normalize set code for URL (e.g. SV4a stays sv4a)
        const cleanSet = extractedSetCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanNum = finalData.card_number.split('/')[0].padStart(3, '0');
        const setIdStr = `${cleanSet}-${cleanNum}`;
        const pData = await scrapePokecaChartAdvancedData(setIdStr);
        if (pData) {
          finalData.pokeca_chart_data = pData;
          m.pokeca_chart_sync = new Date().toISOString();
          
          if (pData.price_compare) {
            m.price_ratio = pData.price_compare.ratio;
            m.price_diff_jpy = pData.price_compare.diff_jpy;
          }
          
          const JPY_TO_HKD_LOCAL = 0.052;
          if (pData.stats?.raw?.latest_price) {
            const fjpy = parseInt(pData.stats.raw.latest_price.replace(/[^\d]/g, ''), 10);
            if (!isNaN(fjpy)) m.raw_price = Math.round(fjpy * JPY_TO_HKD_LOCAL);
          }
          if (pData.stats?.psa10?.latest_price) {
            const fjpy = parseInt(pData.stats.psa10.latest_price.replace(/[^\d]/g, ''), 10);
            if (!isNaN(fjpy)) {
              m.psa10_price = Math.round(fjpy * JPY_TO_HKD_LOCAL);
              m.snkrdunk_price = m.psa10_price;
              m.last_psa10_jpy = fjpy;
            }
          }
        }
      }
    } catch (popErr) {
      console.warn(`Additional scrape failed for ${finalData.card_number}:`, popErr);
    }
  }

  m.updatedAt = new Date().toISOString();
  m.sync_method = stats.method || 'puppet_psa10_filter';
  finalData.market_data = m;
  finalData.updatedAt = new Date().toISOString();

  // --- STEP 2: AI ANALYSIS ---
  try {
    if (ai) {
      const prompt = `你是一位專業的 TCG 市場分析師。請分析這張卡片：${finalData.name_zh || cardId}。
      
      請產出中文分析（繁體）：
      1. analysis_quote: 簡短的一句話點評。
      2. investment_metrics: 包含 growth_potential(0-100), holding_advice (文字), holding_score(0-100)。
      
      JSON 格式：
      {
        "analysis_quote": "...",
        "growth_potential": 85,
        "holding_advice": "...",
        "holding_score": 90
      }
      
      市場資訊參考：
      ${scrapedText ? scrapedText.substring(0, 5000) : "無相關資料"}`;

      console.log(`[SyncService] Analyzing ${finalData.name_zh} (Scraped chars: ${scrapedText.length})`);
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      
      const aiText = response.text || "{}";
      const aiResult = JSON.parse(aiText.replace(/```json|```/g, '') || '{}');
      
      finalData.updatedAt = new Date().toISOString();
      finalData.last_ai_status = scrapedText ? 'success' : 'scraped_empty';

      if (aiResult.analysis_quote) {
        finalData.analysis_quote = aiResult.analysis_quote;
        finalData.investment_metrics = { 
          growth_potential: aiResult.growth_potential, 
          holding_advice: aiResult.holding_advice, 
          holding_score: aiResult.holding_score 
        };
      }
    } else {
      finalData.last_ai_status = 'skipped_no_key';
    }
  } catch(e: any) {
    let msg = e.message || 'unknown error';
    if (msg.includes('API key not valid')) {
      msg = 'Gemini API Key format is invalid (400 INVALID_ARGUMENT). Please check your key settings.';
    } else if (msg.includes('Your prepayment credits are depleted')) {
      msg = 'API Key is out of credits (429 RESOURCE_EXHAUSTED). Please check billing.';
    } else if (msg.includes('404')) {
      msg = 'Gemini model unavailable (404 NOT FOUND). Please check model name.';
    }
    
    console.warn(`[SyncService] AI failed for ${rankKey}: ${msg}`);
    finalData.last_ai_status = 'failed';
    finalData.last_ai_error = msg;
  }

  // Clean up undefined fields
  Object.keys(finalData).forEach(key => {
    if (finalData[key] === undefined) {
      delete finalData[key];
    }
  });

  // Save history to the products collection as well
  try {
    await updateProductPrice(cardId, {
      psa10_price: finalData.market_data?.psa10_price,
      raw_price: finalData.market_data?.raw_price,
      source: 'scraper'
    }, targetDb);
  } catch (e) {
    console.warn(`[SyncService] Failed to record history for ${cardId}:`, e);
  }

  // Save to leaderboard only if it is a real rank
  if (rankKey && rankKey !== 'search_result') {
    if (targetDb.doc && typeof targetDb.doc === 'function') {
      await targetDb.doc(`leaderboard/${rankKey}`).set(finalData);
    } else {
      await setDoc(doc(targetDb, 'leaderboard', rankKey), finalData);
    }
  } else {
    // If it's just a general search result sync, explicitly update the product collection
    // with the analyzed market data directly since updateProductPrice only updates some fields
    try {
      const pUpdate = {
        market_data: finalData.market_data,
        updatedAt: new Date().toISOString(),
      };
      if (finalData.analysis_quote) {
        (pUpdate as any).analysis_quote = finalData.analysis_quote;
        (pUpdate as any).investment_metrics = finalData.investment_metrics;
      }
      
      if (targetDb.doc && typeof targetDb.doc === 'function') {
        await targetDb.doc(`products/${cardId}`).update(pUpdate);
      } else {
        await updateDoc(doc(targetDb, 'products', cardId), pUpdate);
      }
    } catch(e) {
      console.warn(`[SyncService] Failed to merge extra ai data to product ${cardId}:`, e);
    }
  }
  return finalData;
}
