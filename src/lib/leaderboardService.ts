import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleGenAI } from '@google/genai';

export const baselineData = [
  {
    id: 'rank_01',
    card_id: 'snkrdunk_146897',
    rank: 1,
    name_zh: '梵谷皮卡丘 SVP',
    name_jp: 'van_gogh_pikachu',
    card_number: '085/SVP',
    set_name: 'Promo',
    image_url: 'https://images.pokemontcg.io/svp/85_hires.png',
    market_data: { psa10_price: 28000, raw_price: 6200, snkrdunk_price: 28000, ebay_price: 28000, change_24h: '+5.1%', status: 'up' }
  },
  {
    id: 'rank_02',
    card_id: 'snkrdunk_107574',
    rank: 2,
    name_zh: '盔甲夢幻 SM-P',
    name_jp: 'Armored Mewtwo',
    card_number: '365/SM-P',
    set_name: 'SM-P Promo',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SMP/365.png',
    market_data: { psa10_price: 4500, raw_price: 1800, snkrdunk_price: 4500, ebay_price: 4500, change_24h: '0.0%', status: 'stable' }
  },
  {
    id: 'rank_03',
    card_id: 'snkrdunk_103080',
    rank: 3,
    name_zh: '超夢 ex SAR M2 110',
    name_jp: 'Mewtwo VSTAR SAR',
    card_number: '110/080',
    set_name: 'M2',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/S12A/221.png',
    market_data: { psa10_price: 18500, raw_price: 6500, snkrdunk_price: 18500, ebay_price: 18500, change_24h: '+0.5%', status: 'up' }
  },
  {
    id: 'rank_04',
    card_id: 'snkrdunk_128121',
    rank: 4,
    name_zh: '夢幻 ex SAR SV2a',
    name_jp: 'Mew ex SAR',
    card_number: '205/165',
    set_name: 'SV2a 151',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043990_P_MIXYUUEX.jpg',
    market_data: { psa10_price: 7200, raw_price: 2400, snkrdunk_price: 7200, ebay_price: 7200, change_24h: '+1.2%', status: 'up' }
  },
  {
    id: 'rank_05',
    card_id: 'snkrdunk_164250',
    rank: 5,
    name_zh: 'Mew ex SV4a 347/190',
    name_jp: 'ミュウex SAR',
    card_number: '347/190',
    set_name: 'Shiny Treasure ex',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    market_data: { psa10_price: 1200, raw_price: 650, snkrdunk_price: 1200, ebay_price: 1200, change_24h: '+0.8%', status: 'up' }
  },
  {
    id: 'rank_06',
    card_id: 'snkrdunk_128117',
    rank: 6,
    name_zh: 'Charizard ex SV2a 201/165',
    name_hk: '噴火龍 151',
    name_jp: 'Charizard ex SAR',
    card_number: '201/165',
    set_name: 'SV2a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043986_P_RIZADONEX.jpg',
    market_data: { psa10_price: 12800, raw_price: 4500, snkrdunk_price: 12800, ebay_price: 13500, change_24h: '+2.4%', status: 'up' }
  },
  {
    id: 'rank_07',
    card_id: 'snkrdunk_91323',
    rank: 7,
    name_zh: '莉莉艾 SAR SV5a',
    name_jp: 'Lillie SAR',
    card_number: '191/170',
    set_name: 'SV5a',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV5A/191.png',
    market_data: { psa10_price: 38500, raw_price: 12000, snkrdunk_price: 38500, ebay_price: 38500, change_24h: '+12.4%', status: 'up' }
  },
  {
    id: 'rank_08',
    card_id: 'snkrdunk_469638',
    rank: 8,
    name_zh: '皮卡丘 ex UR SV8a',
    name_jp: 'Pikachu ex UR',
    card_number: '236/187',
    set_name: 'SV8a',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV8A/236.png',
    market_data: { psa10_price: 3200, raw_price: 950, snkrdunk_price: 3200, ebay_price: 3200, change_24h: '+5.0%', status: 'up' }
  },
  {
    id: 'rank_09',
    card_id: 'snkrdunk_186243',
    rank: 9,
    name_zh: '耿鬼 ex SAR M2a 240',
    name_jp: 'MEGA Gengar ex SAR',
    card_number: '240/190',
    set_name: 'M2a',
    image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV9/109.png',
    market_data: { psa10_price: 3200, raw_price: 950, snkrdunk_price: 3200, ebay_price: 3200, change_24h: '+5.0%', status: 'up' }
  },
  {
    id: 'rank_10',
    card_id: 'snkrdunk_128117',
    rank: 10,
    name_zh: '噴火龍 ex SAR SV2a',
    name_jp: 'Charizard ex SAR',
    card_number: '201/165',
    set_name: 'SV2a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043986_P_RIZADONEX.jpg',
    market_data: { psa10_price: 12800, raw_price: 4500, snkrdunk_price: 12800, ebay_price: 13500, change_24h: '+2.4%', status: 'up' }
  }
];

const defaultMappings: Record<string, string> = {
  'rank_01': 'snkrdunk_146897',
  'rank_02': 'snkrdunk_107574',
  'rank_03': 'snkrdunk_103080',
  'rank_04': 'snkrdunk_128121',
  'rank_05': 'snkrdunk_164250',
  'rank_06': 'snkrdunk_128117',
  'rank_07': 'snkrdunk_91323',
  'rank_08': 'snkrdunk_469638',
  'rank_09': 'snkrdunk_186243',
  'rank_10': 'snkrdunk_93021'
};

export async function syncLeaderboard(onProgress?: (msg: string) => void, dbOverride?: any, apiKeyOverride?: string) {
  const targetDb = dbOverride || db;
  const rawKey = apiKeyOverride || process.env.GEMINI_API_KEY || '';
  const cleanKey = rawKey.trim();

  let activeMappings: Record<string, string> = { ...defaultMappings };
  try {
    const configSnap = await (targetDb.doc ? targetDb.doc('config/leaderboard').get() : getDoc(doc(targetDb, 'config', 'leaderboard')));
    if (configSnap.exists && (typeof configSnap.exists === 'function' ? configSnap.exists() : true)) {
      const configData = configSnap.data();
      if (configData.rankings && Array.isArray(configData.rankings)) {
        activeMappings = {};
        configData.rankings.forEach((snkrdunkId: string, index: number) => {
          if (index < 10) {
            const rankKey = `rank_${(index + 1).toString().padStart(2, '0')}`;
            activeMappings[rankKey] = snkrdunkId;
          }
        });
      }
    }
  } catch (err) {
    console.warn("Failed to load leaderboard config.");
  }

  if (onProgress) onProgress(`已加載排行榜配置，共 ${Object.keys(activeMappings).length} 個項目`);

  const querySnapshot = await (targetDb.collection ? targetDb.collection('leaderboard').get() : getDocs(collection(targetDb, 'leaderboard')));
  
  const ai = cleanKey ? new GoogleGenAI({ apiKey: cleanKey }) : null;
  let currentItems = querySnapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));

  const workItems = await Promise.all(Object.entries(activeMappings).map(async ([rankKey, forceCardId]) => {
    if (onProgress) onProgress(`正在準備: ${rankKey} -> ${forceCardId}`);
    const existing: any = currentItems.find(curr => curr.id === rankKey);
    const rankNum = parseInt(rankKey.split('_')[1]);
    const baseTemplate = baselineData.find(b => b.id === rankKey) || baselineData[0];
    
    let cardInfo = { ...baseTemplate, id: rankKey, rank: rankNum, card_id: forceCardId };

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
           // Local scraping or logic
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
            model: "gemini-flash-latest",
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
        }
      } catch (e: any) {
        let msg = e.message || 'unknown error';
        if (msg.includes('API key not valid')) {
          msg = 'API key not valid';
        }
        console.warn(`[SyncService] Analysis failed for item ${item.id}: ${msg}`);
      }

      // Final persistence
      if (targetDb.doc) {
        // Record price history if any price data exists
        if (finalData.market_data?.psa10_price || finalData.market_data?.raw_price) {
          try {
            const { updateProductPrice } = await import('./priceService');
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
        const { doc: fsDoc, setDoc: fsSetDoc } = await import('firebase/firestore');
        if (finalData.market_data?.psa10_price || finalData.market_data?.raw_price) {
          try {
            const { updateProductPrice } = await import('./priceService');
            await updateProductPrice(item.card_id, {
              psa10_price: finalData.market_data.psa10_price,
              raw_price: finalData.market_data.raw_price,
              source: 'scraper'
            }, targetDb);
          } catch (e) {}
        }
        await fsSetDoc(fsDoc(targetDb, 'leaderboard', item.id), finalData);
      }
    });

    await Promise.all(syncPromises);
  }
  return true;
}

export async function syncSingleCard(rankKey: string, cardId: string, dbOverride?: any, apiKeyOverride?: string) {
  const targetDb = dbOverride || db;
  const rawKey = apiKeyOverride || process.env.GEMINI_API_KEY || '';
  const cleanKey = rawKey.trim();

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
  let finalData: any = { ...baseTemplate, ...existingData, id: rankKey, rank: rankNum, card_id: cardId, updatedBy: 'bot' };

  // Fetch product meta
  try {
    const pSnap = await (targetDb.doc ? targetDb.doc(`products/${cardId}`).get() : getDoc(doc(targetDb, 'products', cardId)));
    if (pSnap.exists && (typeof pSnap.exists === 'function' ? pSnap.exists() : pSnap.exists)) {
      const p = pSnap.data ? pSnap.data() : pSnap.data;
      if (p) {
        finalData = { 
          ...finalData, 
          name_zh: p.name_zh || p.name || finalData.name_zh, 
          name_jp: p.name_jp || finalData.name_jp, 
          card_number: p.card_number || finalData.card_number, 
          set_name: p.set_name || finalData.set_name, 
          image_url: p.image_url || finalData.image_url,
          // ✅ FIX: Also update market data fields that were previously missing
          pokeca_url: p.pokeca_url || finalData.pokeca_url,
          psa10_hkd: p.psa10_hkd || p.market_data?.psa10_price || finalData.psa10_hkd,
          source: 'pokeca-chart.com',
          // Merge market_data if present in product
          market_data: p.market_data ? { ...finalData.market_data, ...p.market_data } : finalData.market_data
        };
      }
    }
  } catch(e) {
    console.error(`Error fetching product ${cardId}:`, e);
  }

  // --- STEP 1: BROWSING ---
  let scrapedText = "";
  let browser = null;
  const snkrId = cardId.replace('snkrdunk_', '');
  const targetUrl = `https://snkrdunk.com/products/${snkrId}`;

  if (snkrId) {
    try {
      console.log(`[Option 1] Driving real Chrome for: ${snkrId}`);
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      scrapedText = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript, svg, path, footer, nav').forEach(el => el.remove());
        return document.body.innerText.replace(/\s+/g, ' ');
      });
      console.log(`[Option 1] Browser extraction successful.`);
    } catch (err: any) {
      console.warn(`[Option 1] Local browser unavailable: ${err.message}`);
    } finally {
      if (browser) try { await browser.close(); } catch(e) {}
    }
  }

  // --- STEP 1.5: REGEX PRICE EXTRACTION ---
  const extractJpy = (text: string, pattern: RegExp) => {
    const match = text.match(pattern);
    if (!match) return null;
    const cleaned = match[1].replace(/[,¥\s円]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  };

  // More robust patterns: Look for PSA10 followed by price, or the other way around
  let psa10_jpy = extractJpy(scrapedText, /(?:PSA10|PSA\s?10|鑑定品|鑑定済み|鑑定済).*?[¥円]\s?([0-9,]+)/i) || 
                  extractJpy(scrapedText, /[¥円]\s?([0-9,]+).*?(?:PSA10|PSA\s?10|鑑定品)/i) ||
                  extractJpy(scrapedText, /[¥円]\s*([0-9,]+)/);
  
  const raw_jpy = extractJpy(scrapedText, /(?:新品|RAW|未鑑定|通常|未開封).*?[¥円]\s?([0-9,]+)/i) ||
                  extractJpy(scrapedText, /[¥円]\s?([0-9,]+).*?(?:新品|RAW|通常)/i);

  const JPY_TO_HKD = 0.052;
  const m = { ...(finalData.market_data || {}) };
  
  if (psa10_jpy && psa10_jpy > 0) {
    const hkd = Math.round(psa10_jpy * JPY_TO_HKD);
    m.psa10_price = hkd;
    m.snkrdunk_price = hkd;
    m.last_psa10_jpy = psa10_jpy;
    console.log(`[SyncService] FOUND PRICE: PSA10 JPY=${psa10_jpy} -> HK$${hkd}`);
  } else {
    console.warn(`[SyncService] MISSING PRICE: PSA10 not found. Data size: ${scrapedText.length}`);
    if (scrapedText.length > 100) {
      console.log(`[SyncService] Sample text: ${scrapedText.substring(0, 500)}`);
    } else {
       console.error(`[SyncService] PAGE BLOCKED or EMPTY.`);
    }
  }

  if (raw_jpy && raw_jpy > 0) {
    m.raw_price = Math.round(raw_jpy * JPY_TO_HKD);
    m.last_raw_jpy = raw_jpy;
  }
  
  m.updatedAt = new Date().toISOString();
  m.sync_method = 'regex_scraper';
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
        model: "gemini-flash-latest",
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
      msg = 'API key not valid';
    }
    console.warn(`[SyncService] AI failed for ${rankKey}: ${msg}`);
  }

  // Save history to the products collection as well
  try {
    const { updateProductPrice } = await import('./priceService');
    await updateProductPrice(cardId, {
      psa10_price: finalData.market_data?.psa10_price,
      raw_price: finalData.market_data?.raw_price,
      source: 'scraper'
    }, targetDb);
  } catch (e) {
    console.warn(`[SyncService] Failed to record history for ${cardId}:`, e);
  }

  // Save to leaderboard
  if (targetDb.doc) {
    await targetDb.doc(`leaderboard/${rankKey}`).set(finalData);
  } else {
    const { doc: fsDoc, setDoc: fsSetDoc } = await import('firebase/firestore');
    await fsSetDoc(fsDoc(targetDb, 'leaderboard', rankKey), finalData);
  }
  return finalData;
}
