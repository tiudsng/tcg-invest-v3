/**
 * TCGVest Card Types — Unified Card Data Model
 * 
 * Architecture: Single Source of Truth (SSOT) for card data access.
 * 
 * Data Flow:
 *   Firestore (dirty/legacy) → normalizeCard() → Product (clean/typed) → UI
 * 
 * Key decisions:
 *   - All PSA ratio values are stored as percentage STRINGS with '%' suffix in the UI layer
 *   - Numeric PSA values (counts, ratios) are preserved separately for calculations
 *   - Fallback hierarchy: leaderboard → psa_data → top-level → defaults
 */

// ═══════════════════════════════════════════════════════════
// CORE UNIFIED TYPES
// ═══════════════════════════════════════════════════════════

/** PSA population breakdown by grade */
export interface PsaPopulation {
  psa10: number;
  psa9: number;
  psa8: number;
  psa7: number;
  psa6: number;
  psa5: number;
  psa4: number;
  psa3: number;
  psa2: number;
  psa1: number;
}

/** Market price data — unified across all sources */
export interface MarketData {
  // PSA10 market price (HKD)
  psa10_price: number;
  // RAW/ungraded market price (HKD)
  raw_price: number;
  // PSA10 market price (JPY)
  psa10_latest_jpy: number;
  // PSA10 lowest price (HKD)
  psa10_hkd_lowest: number;
  // PSA10 median (HKD)
  psa10_hkd_median: number;
  // Price change percentage string, e.g. "+2.5%" or "-1.0%"
  change_pct: string;
  // Data source name, e.g. "snkrdunk" | "pokeca-chart"
  source: string;
  // PSA10 population count
  psa_pop_10: number;
  // Total PSA graded population
  psa_pop_total: number;
  // PSA10 as percentage of total — ALWAYS a string with '%', e.g. "28.4%"
  psa_pop_10_percent: string;
  // Last updated timestamp (ISO string for display)
  last_updated: string;
}

/** PSA population data from PriceCharting */
export interface PsaData {
  // Raw population counts by grade
  populations: PsaPopulation;
  // PSA10 count (derived from populations.psa10)
  psa10_count: number;
  // Total graded (derived from sum of all populations)
  total_graded: number;
  // PSA10 ratio as percentage string with '%' suffix
  psa10_ratio: string;
  // PSA10 ratio as raw number (e.g. 28.4 for 28.4%)
  psa10_ratio_numeric: number;
  // PriceCharting URL for this card
  grading_url: string;
  // Last scraped timestamp
  last_fetched: string;
}

/** Investment analysis metadata */
export interface InvestmentMetrics {
  growth_potential: '極強' | '強' | '中' | '低';
  holding_advice: '長期 (2-3年)' | '中期 (1-2年)' | '短期 (<1年)';
  holding_score: number; // 0-100
  liquidity: '極高' | '高' | '中' | '低';
  volatility: '極高' | '高' | '中' | '低';
  asset_class: 'LEVEL S' | 'LEVEL A' | 'LEVEL B' | 'LEVEL C';
}

/** Unified card document — all UI reads from this shape */
export interface CardDoc {
  // Firestore document ID
  id: string;
  // Display name (Chinese)
  name_zh: string;
  // Display name (Japanese)
  name_jp: string;
  // Display name (English)
  name_en: string;
  // Set code (e.g. "sv2d", "sm11", "SM-P")
  set_code: string;
  // Card number in set
  card_number: string;
  // Image URL
  image_url: string;
  // Market price & PSA population data
  market_data: MarketData;
  // PSA population breakdown from PriceCharting
  psa_data: PsaData;
  // Investment analysis
  investment_metrics: InvestmentMetrics;
  // Analysis quote text
  analysis_quote: string;
  // Which Firestore collection this came from
  collection_name: string;
  // Data source URL (for display link)
  source_url: string;
}

// ═══════════════════════════════════════════════════════════
// FALLBACK DEFAULTS — safe zero-values for missing fields
// ═══════════════════════════════════════════════════════════

export const DEFAULT_MARKET_DATA: MarketData = {
  psa10_price: 0,
  raw_price: 0,
  psa10_latest_jpy: 0,
  psa10_hkd_lowest: 0,
  psa10_hkd_median: 0,
  change_pct: '0%',
  source: 'unknown',
  psa_pop_10: 0,
  psa_pop_total: 0,
  psa_pop_10_percent: '0%',
  last_updated: '',
};

export const DEFAULT_PSA_DATA: PsaData = {
  populations: { psa10: 0, psa9: 0, psa8: 0, psa7: 0, psa6: 0, psa5: 0, psa4: 0, psa3: 0, psa2: 0, psa1: 0 },
  psa10_count: 0,
  total_graded: 0,
  psa10_ratio: '0%',
  psa10_ratio_numeric: 0,
  grading_url: '',
  last_fetched: '',
};

export const DEFAULT_INVESTMENT: InvestmentMetrics = {
  growth_potential: '中',
  holding_advice: '中期 (1-2年)',
  holding_score: 50,
  liquidity: '中',
  volatility: '中',
  asset_class: 'LEVEL B',
};

// ═══════════════════════════════════════════════════════════
// DATA ADAPTER — normalizeCard()
// ═══════════════════════════════════════════════════════════
//
// Mission: Take raw Firestore data from ANY collection (leaderboard,
// new_products, pokeca_gold, psa_prices) and return a fully-typed CardDoc
// with ALL fields guaranteed to have safe values.
//
// This is the SINGLE EXIT POINT for all card data reads.
// No component should ever read Firestore data directly — always
// go through normalizeCard().
//
// Fallback hierarchy:
//   leaderboard.market_data.* > psa_data.* > top-level doc fields > DEFAULT_*
//
// PSA ratio display format: ALWAYS string with '%' suffix (e.g. "28.4%")
// PSA ratio numeric format: ALWAYS number (e.g. 28.4)
// ═══════════════════════════════════════════════════════════

/** Raw Firestore document shape — intentionally loose to handle all sources */
interface RawFirestoreDoc {
  id?: string;
  name_zh?: string;
  name_jp?: string;
  name_en?: string;
  set_name?: string;
  set_code?: string;
  card_number?: string;
  slug?: string;
  snkrdunk_id?: string;
  card_id?: string;
  img_url?: string;
  image_url?: string;
  price?: number;
  rarity?: string;
  // Market data (may or may not exist)
  market_data?: {
    psa10_price?: number | string;
    raw_price?: number | string;
    psa10_latest_jpy?: number | string;
    psa10_hkd_lowest?: number | string;
    psa10_hkd_median?: number | string;
    psa_pop_10?: number | string;
    psa_pop_total?: number | string;
    psa_pop_10_percent?: number | string;
    snkrdunk_price?: number | string;
    change_pct?: string;
    source?: string;
    last_updated?: any; // Firestore Timestamp or ISO string
  };
  // PSA data from PriceCharting (nested in leaderboard/new_products)
  psa_data?: {
    populations?: number[];
    psa10_count?: number;
    psa10_ratio?: number | string;
    total_graded?: number;
    grading_url?: string;
    last_fetched?: string;
  };
  // Investment metrics
  growth_potential?: string;
  holding_advice?: string;
  holding_score?: number;
  asset_class?: string;
  // Analysis
  analysis_quote?: string;
  // Source tracking
  collection_name?: string;
  // Top-level timestamp (leaderboard sometimes stores here instead of market_data)
  last_updated?: any;
}

/**
 * Normalize a raw Firestore document into a safe, fully-typed CardDoc.
 * 
 * @param docId - Firestore document ID
 * @param raw - Raw document data from Firestore (any collection)
 * @param sourceCollection - Name of the source collection for tracking
 */
export function normalizeCard(docId: string, raw: RawFirestoreDoc, sourceCollection: string): CardDoc {
  
  // ── PSA Population Derivation ──────────────────────────────
  // PSA data can come as populations array or as individual fields
  const rawPsa = raw.psa_data || {};
  let populations: PsaPopulation = DEFAULT_PSA_DATA.populations;
  let psa10Count = 0;
  let totalGraded = 0;

  if (rawPsa.populations && Array.isArray(rawPsa.populations) && rawPsa.populations.length >= 1) {
    // PriceCharting format: [psa1, psa2, psa3, ..., psa10]
    const psaArray = rawPsa.populations;
    populations = {
      psa1:  psaArray[0]  || 0,
      psa2:  psaArray[1]  || 0,
      psa3:  psaArray[2]  || 0,
      psa4:  psaArray[3]  || 0,
      psa5:  psaArray[4]  || 0,
      psa6:  psaArray[5]  || 0,
      psa7:  psaArray[6]  || 0,
      psa8:  psaArray[7]  || 0,
      psa9:  psaArray[8]  || 0,
      psa10: psaArray[9]  || 0,
    };
    psa10Count = populations.psa10;
    totalGraded = psaArray.reduce((sum: number, v: number) => sum + (v || 0), 0);
  } else if (rawPsa.psa10_count != null) {
    psa10Count = Number(rawPsa.psa10_count);
    totalGraded = Number(rawPsa.total_graded) || psa10Count;
  }

  // ── PSA10 Ratio ────────────────────────────────────────────
  // Preferred source: market_data.psa_pop_10_percent (string with %)
  // Fallback: psa_data.psa10_ratio (number or string)
  // Format: ALWAYS string with '%' suffix
  const md = raw.market_data || {};
  let psaRatioStr = '0%';
  let psaRatioNum = 0;

  const rawRatio = md.psa_pop_10_percent ?? rawPsa.psa10_ratio;
  if (rawRatio != null && rawRatio !== '' && rawRatio !== 'undefined%') {
    const ratioNum = typeof rawRatio === 'number' ? rawRatio : parseFloat(String(rawRatio));
    if (!isNaN(ratioNum)) {
      psaRatioNum = ratioNum;
      psaRatioStr = `${ratioNum}%`;
    }
  } else if (psa10Count > 0 && totalGraded > 0) {
    psaRatioNum = Math.round((psa10Count / totalGraded) * 1000) / 10;
    psaRatioStr = `${psaRatioNum}%`;
  }

  // ── Market Price ───────────────────────────────────────────
  const psa10Price = Number(md.psa10_price ?? md.psa10_latest_jpy ?? raw.price ?? 0);
  const rawPrice = Number(md.raw_price ?? 0);

  // ── Last Updated ───────────────────────────────────────────
  let lastUpdated = '';
  const ts = md.last_updated ?? raw.last_updated;
  if (ts) {
    if (typeof ts.toDate === 'function') {
      // Firestore Timestamp
      lastUpdated = ts.toDate().toISOString();
    } else if (typeof ts === 'string') {
      lastUpdated = ts;
    } else if (typeof ts === 'number') {
      lastUpdated = new Date(ts * 1000).toISOString();
    }
  }

  // ── Investment Metrics ─────────────────────────────────────
  const investment: InvestmentMetrics = {
    growth_potential: (raw.growth_potential as any) || '中',
    holding_advice: (raw.holding_advice as any) || '中期 (1-2年)',
    holding_score: Number(raw.holding_score) || 50,
    liquidity: '中',
    volatility: '中',
    asset_class: (raw.asset_class as any) || 'LEVEL B',
  };

  return {
    id: docId,
    name_zh: raw.name_zh || raw.name_jp || raw.name_en || docId,
    name_jp: raw.name_jp || raw.name_en || '',
    name_en: raw.name_en || '',
    set_code: raw.set_code || '',
    card_number: raw.card_number || raw.slug || '',
    image_url: raw.img_url || raw.image_url || '',
    market_data: {
      psa10_price: psa10Price,
      raw_price: rawPrice,
      psa10_latest_jpy: Number(md.psa10_latest_jpy) || 0,
      psa10_hkd_lowest: Number(md.psa10_hkd_lowest) || 0,
      psa10_hkd_median: Number(md.psa10_hkd_median) || 0,
      change_pct: md.change_pct || '0%',
      source: md.source || sourceCollection,
      psa_pop_10: Number(md.psa_pop_10) || psa10Count || 0,
      psa_pop_total: Number(md.psa_pop_total) || totalGraded || 0,
      psa_pop_10_percent: psaRatioStr,
      last_updated: lastUpdated,
    },
    psa_data: {
      populations,
      psa10_count: psa10Count,
      total_graded: totalGraded,
      psa10_ratio: psaRatioStr,
      psa10_ratio_numeric: psaRatioNum,
      grading_url: rawPsa.grading_url || '',
      last_fetched: rawPsa.last_fetched || '',
    },
    investment_metrics: investment,
    analysis_quote: raw.analysis_quote || '尚無足夠數據生成分析',
    collection_name: sourceCollection,
    source_url: rawPsa.grading_url || '',
  };
}

// ═══════════════════════════════════════════════════════════
// SNKRDRUNK CDN UTILITIES
// ═══════════════════════════════════════════════════════════

export const SNKRDUNK_CDN_BASE = 'https://cdn.snkrdunk.com/cdn/media/2022/12/07/_res/medium';

export function getSnkrdunkImageUrl(snkrdunkId: string): string {
  if (!snkrdunkId) return '/placeholder-card.png';
  return `${SNKRDUNK_CDN_BASE}/${snkrdunkId}.webp`;
}

export function parseCardDisplay(display: string): { set_code: string; card_number: string } | null {
  const match = display.match(/\[([a-z0-9]+)-(\d+)\]/i);
  if (match) {
    return { set_code: match[1].toLowerCase(), card_number: match[2] };
  }
  return null;
}
