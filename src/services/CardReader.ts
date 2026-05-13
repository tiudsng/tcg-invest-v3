import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { normalizeCard, CardDoc, DEFAULT_MARKET_DATA, DEFAULT_PSA_DATA, DEFAULT_INVESTMENT } from '../types/card';

/**
 * CardReader — Single Exit Point for all card data reads.
 * 
 * All Firestore data MUST pass through normalizeCard() before reaching UI.
 * This ensures every field has a safe fallback value — no undefined, no "undefined%".
 */

export class CardReader {
  /**
   * Reads a card from pokeca_gold, or leaderboard, or products.
   * Also triggers any updates if needed.
   */
  static async getCard(id: string): Promise<Product | null> {
    const rawId = id.replace('snkrdunk_', '');
    const snkrId = id.startsWith('snkrdunk_') ? id : `snkrdunk_${id}`;

    // Handle rank_XX format — query leaderboard directly, then resolve card_id
    if (/^rank_\d+$/.test(id)) {
      const lbRef = doc(db, 'leaderboard', id);
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        const lbData = lbSnap.data();
        const cardId = lbData.card_id || lbData.snkrdunk_id;
      // ✅ FIX: leaderboard has complete display data including psa10_price & psa_pop
      // Do NOT recurse to pokeca_gold — its null fields would overwrite good leaderboard data
      // pokeca_gold is a supplemental card DB, not needed for leaderboard display
      return this.adaptToProduct(id, lbData, 'leaderboard');
      }
      return null;
    }

    let cardData: any = null;
    let source = '';

    // 1. Try pokeca_gold collection first (using raw numeric ID usually)
    const goldRef = doc(db, 'pokeca_gold', rawId);
    const goldSnap = await getDoc(goldRef);
    
    if (goldSnap.exists()) {
      cardData = goldSnap.data();
      source = 'pokeca_gold';
    } else {
      // Also try with snkrId just in case
      const goldRefAlt = doc(db, 'pokeca_gold', snkrId);
      const goldSnapAlt = await getDoc(goldRefAlt);
      if (goldSnapAlt.exists()) {
        cardData = goldSnapAlt.data();
        source = 'pokeca_gold';
      }
    }
    
    // 2. Try leaderboard using snkrdunk_<id> if it's snkrdunk ID
    if (!cardData) {
      const lbRef = doc(db, 'leaderboard', snkrId);
      const lbSnap = await getDoc(lbRef);
      if (lbSnap.exists()) {
        cardData = lbSnap.data();
        source = 'leaderboard';
      }
    }

    // 3. Try new_products
    if (!cardData) {
      const npRef = doc(db, 'new_products', snkrId);
      const npSnap = await getDoc(npRef);
      if (npSnap.exists()) {
        cardData = npSnap.data();
        source = 'new_products';
      } else {
        const baseNPRef = doc(db, 'new_products', rawId);
        const baseNPSnap = await getDoc(baseNPRef);
        if (baseNPSnap.exists()) {
          cardData = baseNPSnap.data();
          source = 'new_products';
        }
      }
    }

    // 4. Try products (legacy fallback just in case)
    if (!cardData) {
      const pRef = doc(db, 'products', snkrId);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        cardData = pSnap.data();
        source = 'products';
      } else {
        // Fallback check direct id without prefix
        const basePRef = doc(db, 'products', rawId);
        const basePSnap = await getDoc(basePRef);
        if (basePSnap.exists()) {
          cardData = basePSnap.data();
          source = 'products';
        }
      }
    }

    if (!cardData) return null;

    // Convert standard shape
    // Assuming pokeca_gold structure needs adapting to Product interface
    const mappedData = this.adaptToProduct(id, cardData, source);

    return mappedData;
  }

  private static adaptToProduct(id: string, data: any, source: string): Product {
    // ✅ Use normalizeCard() as single exit point for all data normalization.
    // This guarantees every field has a safe fallback — no undefined, no "undefined%".
    const normalized = normalizeCard(id, data, source);

    // Convert CardDoc (new unified type) → Product (legacy UI type).
    // This adapter layer exists to avoid rewriting ProductDetail.tsx right now.
    // Long-term: ProductDetail should consume CardDoc directly.
    const growthNum = normalized.investment_metrics.growth_potential === '極強' ? 95
      : normalized.investment_metrics.growth_potential === '強' ? 75
      : normalized.investment_metrics.growth_potential === '中' ? 50 : 25;
    return {
      id: normalized.id,
      card_id: normalized.id,
      rank: 0,
      name: normalized.name_zh,
      name_zh: normalized.name_zh,
      name_hk: normalized.name_zh,
      name_jp: normalized.name_jp,
      card_number: normalized.card_number,
      set_code: normalized.set_code,
      set_name: data.set_name || data.series_info || '',
      image_url: normalized.image_url,
      imageUrl: normalized.image_url,
      market_data: {
        // UI expects psa_pop_10_percent as string with '%' — normalizeCard guarantees this
        snkrdunk_price: normalized.market_data.psa10_price,
        ebay_price: 0,
        change_24h: normalized.market_data.change_pct,
        status: 'active',
        psa10_price: normalized.market_data.psa10_price,
        raw_price: normalized.market_data.raw_price,
        snkdunk_price: normalized.market_data.psa10_price,
        psa_pop_total: normalized.market_data.psa_pop_total,
        psa_pop_10: normalized.market_data.psa_pop_10,
        psa10_population: normalized.market_data.psa_pop_10,
        psa_pop_10_percent: normalized.market_data.psa_pop_10_percent,
        last_updated: normalized.market_data.last_updated,
      },
      analysis_quote: normalized.analysis_quote,
      data_source: normalized.source_url,
      collection_name: normalized.collection_name,
      investment_metrics: {
        growth_potential: growthNum, // UI checks >= 80 for '極強', so use 95
        holding_advice: normalized.investment_metrics.holding_advice,
        holding_score: normalized.investment_metrics.holding_score,
      },
      updatedAt: normalized.market_data.last_updated,
    } as Product;
  }
}
