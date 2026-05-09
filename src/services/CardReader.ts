import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';

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
        if (cardId) {
          // Recursively resolve the actual card_id
          return this.getCard(cardId);
        }
        // Fallback: return leaderboard doc adapted as Product
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
    // If it already contains market_data, it's mostly structured
    // Normalize properties
    
    let snkrdunk_id = data.snkrdunk_id || id.replace('snkrdunk_', '');
    let card_id = data.card_id || `snkrdunk_${snkrdunk_id}`;
    
    return {
      id: id,
      card_id: card_id,
      name_zh: data.name_zh || data.name_jp || '',
      name_jp: data.name_jp || data.name_en || '',
      name_en: data.name_en || '',
      set_name: data.set_name || data.series_info || '',
      set_code: data.set_code || '',
      card_number: data.card_number || data.slug || '',
      image_url: data.img_url || data.image_url || '',
      market_data: {
        ...(data.market_data || {}),
        snkrdunk_price: data.price || data.market_data?.psa10_price || data.market_data?.snkrdunk_price || 0,
        source: data.market_data?.source || source,
      },
      collection_name: source,
      ...data
    } as Product;
  }
}
