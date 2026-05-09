/**
 * CardReader Service
 * 
 * Single Source of Truth for PTCG card data.
 * Reads from pokeca_gold collection using SNKRDUNK ID as document key.
 * 
 * Data Flow:
 * 1. Read card metadata from Firestore (pokeca_gold collection)
 * 2. Auto-construct image URL from SNKRDUNK CDN if not stored
 * 3. Check data freshness and trigger background refresh if needed
 * 4. Return complete card data to UI
 */

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { PokecaGoldCard, getSnkrdunkImageUrl } from '../../types/card';

// Stale data threshold: 24 hours
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface CardReaderResult {
  card: PokecaGoldCard;
  isStale: boolean;
  imageUrl: string;
}

export const CardReader = {
  /**
   * Get a single card by SNKRDUNK ID
   * 
   * @param snkrdunkId - Firestore document ID (same as SNKRDUNK product ID)
   * @param options.forceRefresh - If true, skip cache and fetch fresh data
   * @returns Card data with metadata, or null if not found
   */
  async getCard(snkrdunkId: string, options?: { forceRefresh?: boolean }): Promise<PokecaGoldCard | null> {
    if (!snkrdunkId) {
      console.warn('[CardReader] getCard called with empty snkrdunkId');
      return null;
    }

    try {
      const cardRef = doc(db, 'pokeca_gold', snkrdunkId);
      const cardSnap = await getDoc(cardRef);

      if (!cardSnap.exists()) {
        console.warn(`[CardReader] Card not found in pokeca_gold: ${snkrdunkId}`);
        return null;
      }

      const data = cardSnap.data() as PokecaGoldCard;
      data.id = cardSnap.id; // Ensure id matches doc ID

      // Auto-construct image URL if not stored
      if (!data.image_url) {
        data.image_url = getSnkrdunkImageUrl(snkrdunkId);
      }

      return data;
    } catch (error) {
      console.error(`[CardReader] Error fetching card ${snkrdunkId}:`, error);
      return null;
    }
  },

  /**
   * Get card with stale check and auto-refresh trigger
   * 
   * Returns card data immediately, triggers background refresh if data is old.
   * This ensures UI never blocks on data freshness.
   */
  async getCardWithFreshness(snkrdunkId: string): Promise<CardReaderResult | null> {
    const card = await this.getCard(snkrdunkId);
    if (!card) return null;

    // Check data freshness
    const isStale = this.isDataStale(card);
    
    // Trigger background refresh if stale (non-blocking)
    if (isStale) {
      this.triggerDataRefresh(snkrdunkId).catch(err => 
        console.error(`[CardReader] Background refresh failed for ${snkrdunkId}:`, err)
      );
    }

    return {
      card,
      isStale,
      imageUrl: card.image_url || getSnkrdunkImageUrl(snkrdunkId)
    };
  },

  /**
   * Check if card data is stale (older than STALE_THRESHOLD_MS)
   */
  isDataStale(card: PokecaGoldCard): boolean {
    if (!card.updatedAt && !card.market_data?.updated_at) {
      return true; // No timestamp = assume stale
    }

    const updatedAt = card.updatedAt || card.market_data?.updated_at;
    if (!updatedAt) return true;

    const timestamp = new Date(updatedAt).getTime();
    if (isNaN(timestamp)) return true;

    return Date.now() - timestamp > STALE_THRESHOLD_MS;
  },

  /**
   * Trigger async data refresh from pokeca-chart API
   * 
   * This fetches latest PSA population and market price data,
   * then writes back to Firestore. Non-blocking - does not wait for completion.
   */
  async triggerDataRefresh(snkrdunkId: string): Promise<void> {
    console.log(`[CardReader] Triggering data refresh for ${snkrdunkId}`);

    try {
      // Step 1: Get slug from card to build pokeca-chart URL
      const card = await this.getCard(snkrdunkId);
      if (!card || !card.slug) {
        console.log(`[CardReader] No slug found for ${snkrdunkId}, skipping refresh`);
        return;
      }

      // Step 2: Fetch PSA population + market price from pokeca-chart API
      const psaData = await this.fetchPsaDataFromPokeca(card.slug);
      const marketData = await this.fetchMarketDataFromPokeca(card.slug);

      // Step 3: Write back to Firestore (merge with existing data)
      const updateData: Partial<PokecaGoldCard> = {
        updatedAt: new Date().toISOString()
      };

      if (psaData) {
        updateData.psa_data = {
          ...psaData,
          last_fetched: new Date().toISOString()
        };
      }

      if (marketData) {
        updateData.market_data = {
          ...(card.market_data || {}),
          ...marketData,
          updated_at: new Date().toISOString()
        };
      }

      await updateDoc(doc(db, 'pokeca_gold', snkrdunkId), updateData as Record<string, unknown>);
      console.log(`[CardReader] Successfully refreshed data for ${snkrdunkId}`);
    } catch (error) {
      console.error(`[CardReader] Data refresh failed for ${snkrdunkId}:`, error);
      throw error; // Re-throw so caller knows it failed
    }
  },

  /**
   * Fetch PSA population data from pokeca-chart.com API
   * 
   * API Endpoint:
   *   GET https://pokeca-chart.com/ch/php/get-item-id.php?slug={slug} → item_id
   *   GET https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id={item_id}
   */
  async fetchPsaDataFromPokeca(slug: string): Promise<Partial<{
    psa10: number;
    psa9: number;
    psa8: number;
    psa_all: number;
    psa10_pct: number;
    grading_url: string;
  }> | null> {
    try {
      // Step 1: Resolve slug to item_id
      const idResponse = await fetch(
        `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`
      );
      const itemIdText = await idResponse.text();
      const itemId = parseInt(itemIdText.trim(), 10);
      
      if (isNaN(itemId) || itemId === 0) {
        console.log(`[CardReader] No item_id found for slug: ${slug}`);
        return null;
      }

      // Step 2: Get PSA population data
      const grdResponse = await fetch(
        `https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=${itemId}`
      );
      const grdData = await grdResponse.json();

      if (!grdData || grdData.length === 0) {
        return null;
      }

      const info = grdData[0];
      return {
        psa10: info.grd_status_10 || 0,
        psa9: info.grd_status_9 || 0,
        psa8: info.grd_status_8 || 0,
        psa_all: info.grd_status_all || 0,
        psa10_pct: info.grd_status_all > 0 
          ? Math.round((info.grd_status_10 / info.grd_status_all) * 10000) / 100 
          : 0,
        grading_url: `https://grading.pokeca-chart.com/${slug}`
      };
    } catch (error) {
      console.error(`[CardReader] Failed to fetch PSA data for ${slug}:`, error);
      return null;
    }
  },

  /**
   * Fetch market price data from pokeca-chart.com
   * 
   * Same API as above - get_item_grd_info returns both PSA population AND prices:
   *   recent_price_0 = RAW lowest price (JPY)
   *   recent_price_2 = PSA10 lowest price (JPY)
   */
  async fetchMarketDataFromPokeca(slug: string): Promise<Partial<{
    psa10_latest_jpy: number;
    raw_latest_jpy: number;
    source: string;
  }> | null> {
    try {
      // Step 1: Resolve slug to item_id
      const idResponse = await fetch(
        `https://pokeca-chart.com/ch/php/get-item-id.php?slug=${encodeURIComponent(slug)}`
      );
      const itemIdText = await idResponse.text();
      const itemId = parseInt(itemIdText.trim(), 10);
      
      if (isNaN(itemId) || itemId === 0) {
        return null;
      }

      // Step 2: Get market price data
      const grdResponse = await fetch(
        `https://pokeca-chart.com/ch/php/get.php?function=get_item_grd_info&item_id=${itemId}`
      );
      const grdData = await grdResponse.json();

      if (!grdData || grdData.length === 0) {
        return null;
      }

      const info = grdData[0];
      
      // Parse prices from format "199,999円" -> number
      const parsePrice = (priceStr: string): number => {
        if (!priceStr) return 0;
        return parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
      };

      return {
        psa10_latest_jpy: parsePrice(info.recent_price_2),
        raw_latest_jpy: parsePrice(info.recent_price_0),
        source: 'pokeca-chart'
      };
    } catch (error) {
      console.error(`[CardReader] Failed to fetch market data for ${slug}:`, error);
      return null;
    }
  },

  /**
   * Batch fetch multiple cards
   * Useful for Grid view cover page
   */
  async getCards(snkrdunkIds: string[]): Promise<PokecaGoldCard[]> {
    const results = await Promise.all(
      snkrdunkIds.map(id => this.getCard(id))
    );
    return results.filter((card): card is PokecaGoldCard => card !== null);
  }
};

export default CardReader;