/**
 * TCGVest Card Types
 * Pokeca Gold Collection Data Model
 */

export interface MarketData {
  // PSA10 market price in HKD (from SNKRDUNK/pokeca-chart)
  psa10_price?: number;
  // RAW (ungraded) market price in HKD
  raw_price?: number;
  // PSA10 market price in JPY
  psa10_latest_jpy?: number;
  // RAW market price in JPY
  raw_latest_jpy?: number;
  // PSA10 lowest price in HKD
  psa10_hkd_lowest?: number;
  // RAW lowest price in HKD
  raw_hkd_lowest?: number;
  // PSA10 median in JPY
  psa10_median?: number;
  // PSA10 median in HKD
  psa10_hkd_median?: number;
  // PSA10 count (number of PSA10 graded in market)
  psa10_count?: number;
  // Price change percentage (e.g., "+0.00%", "-2.5%")
  change_pct?: string;
  // Data source (e.g., "pokeca-chart")
  source?: string;
  // Last updated timestamp
  updated_at?: string;
  // Last updated ISO string
  last_updated?: string;
}

export interface PsaData {
  // PSA10 population count
  psa10?: number;
  // PSA9 population count
  psa9?: number;
  // PSA8 population count
  psa8?: number;
  // Total PSA graded population
  psa_all?: number;
  // PSA10 percentage (e.g., 76.83)
  psa10_pct?: number;
  // PSA population data source URL
  grading_url?: string;
  // Last fetched timestamp
  last_fetched?: string;
}

export interface PokecaGoldCard {
  /** Firestore Document ID (also SNKRDUNK product ID) */
  id: string;
  /** Japanese card name (primary display name) */
  name_jp: string;
  /** English card name */
  name_en?: string;
  /** Set code (e.g., "sv2d", "s12a", "sm11a") */
  set_code: string;
  /** Card number in set (e.g., "93", "261") */
  card_number: string;
  /** Display name format: "Name [set_code-card_number]" */
  display?: string;
  /** pokeca-chart.com URL slug (e.g., "sv2d-093", "400-sm-p") */
  slug?: string;
  /** SNKRDUNK product ID (same as doc id, but stored for clarity) */
  snkrdunk_id?: string;
  /** Image URL (if stored in Firestore, otherwise use getSnkrdunkImageUrl) */
  image_url?: string;
  /** Market price data */
  market_data?: MarketData;
  /** PSA population data */
  psa_data?: PsaData;
  /** Card rarity (e.g., "SAR", "UR", "HR") */
  rarity?: string;
  /** Updated timestamp */
  updatedAt?: string;
  /** Last scraped timestamp */
  last_scraped?: string;
}

/**
 * Snkrdunk URL construction formula:
 * https://cdn.snkrdunk.com/cdn/media/2022/12/07/_res/medium/{snkrdunkId}.webp
 */
export const SNKRDUNK_CDN_BASE = 'https://cdn.snkrdunk.com/cdn/media/2022/12/07/_res/medium';

/**
 * Get SNKRDUNK CDN image URL from SNKRDUNK ID
 */
export function getSnkrdunkImageUrl(snkrdunkId: string): string {
  if (!snkrdunkId) return '/placeholder-card.png';
  return `${SNKRDUNK_CDN_BASE}/${snkrdunkId}.webp`;
}

/**
 * Parse card number to extract set_code and card_number from display
 * e.g., "デカヌチャンex SAR [sv2d-93]" -> { set_code: "sv2d", card_number: "93" }
 */
export function parseCardDisplay(display: string): { set_code: string; card_number: string } | null {
  const match = display.match(/\[([a-z0-9]+)-(\d+)\]/i);
  if (match) {
    return { set_code: match[1].toLowerCase(), card_number: match[2] };
  }
  return null;
}