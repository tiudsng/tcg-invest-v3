import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface PriceRecord {
  psa10_price?: number;
  raw_price?: number;
  source?: 'bot' | 'scraper' | 'manual';
}

/**
 * Updates a product's current price and records it in the history subcollection.
 */
export async function updateProductPrice(productId: string, record: PriceRecord, dbOverride?: any) {
  if (!productId) return;

  const targetDb = dbOverride || db;
  const now = new Date().toISOString();
  
  // Prepare market data update
  const market_data: any = { last_updated: now };
  if (record.psa10_price !== undefined) market_data.psa10_price = record.psa10_price;
  if (record.raw_price !== undefined) market_data.raw_price = record.raw_price;

  const productUpdate = {
    market_data,
    updatedBy: record.source || 'system',
    last_history_sync: now
  };

  const historyData = {
    psa10_price: record.psa10_price || null,
    raw_price: record.raw_price || null,
    source: record.source || 'system',
    createdAt: new Date() // Fallback to JS date if serverTimestamp fails
  };

  try {
    // Determine if we are using Firebase Admin or Client SDK
    if (targetDb.doc && typeof targetDb.doc === 'function') {
      // Firebase Admin SDK
      const productRef = targetDb.doc(`products/${productId}`);
      await productRef.set(productUpdate, { merge: true });
      
      const historyRef = productRef.collection('price_history');
      await historyRef.add({
        ...historyData,
        createdAt: new Date() // Admin uses JS Date or FieldValue.serverTimestamp()
      });
    } else {
      // Firebase Client SDK
      const productRef = doc(targetDb, 'products', productId);
      await setDoc(productRef, productUpdate, { merge: true });
      
      const historyRef = collection(productRef, 'price_history');
      await addDoc(historyRef, {
        ...historyData,
        createdAt: serverTimestamp()
      });
    }
    console.log(`[PriceService] Recorded history for ${productId}: PSA10=${record.psa10_price}, RAW=${record.raw_price}`);
  } catch (err) {
    console.error(`[PriceService] Error updating product ${productId}:`, err);
    throw err;
  }
}
