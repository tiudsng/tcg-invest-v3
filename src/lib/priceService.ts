import { doc, setDoc, addDoc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';

export interface PriceRecord {
  psa10_price?: number;
  raw_price?: number;
  psa10_population?: number;
  psa_pop_total?: number;
  source?: 'bot' | 'scraper' | 'manual';
}

/**
 * Updates a product's current price and records it in the history subcollection.
 */
export async function updateProductPrice(productId: string, record: PriceRecord, dbOverride?: any, targetCollection: string = 'products') {
  if (!productId) return;

  const targetDb = dbOverride || db;
  const now = new Date().toISOString();
  
  // Prepare market data update
  const market_data: any = { last_updated: now };
  if (record.psa10_price !== undefined) market_data.psa10_price = record.psa10_price;
  if (record.raw_price !== undefined) market_data.raw_price = record.raw_price;
  if (record.psa10_population !== undefined) market_data.psa10_population = record.psa10_population;
  if (record.psa_pop_total !== undefined) market_data.psa_pop_total = record.psa_pop_total;

  const productUpdate: any = {
    market_data,
    updatedBy: record.source || 'system',
    last_history_sync: now,
  };

  const historyData = {
    psa10_price: record.psa10_price || null,
    raw_price: record.raw_price || null,
    source: record.source || 'system',
    createdAt: new Date() // Fallback to JS date if serverTimestamp fails
  };

  try {
    // Determine if we are using Firebase Admin or Client SDK
    if (targetDb.doc && typeof targetDb.doc === 'function' && targetDb.collection && typeof targetDb.collection === 'function') {
      // Firebase Admin SDK
      const productRef = targetDb.doc(`${targetCollection}/${productId}`);
      
      // Admin SDK increment - try to find FieldValue
      let incValue: any = 1; 
      try {
        const { FieldValue } = await import('firebase-admin/firestore');
        incValue = FieldValue.increment(1);
      } catch (e) {
        // Fallback or skip increment if not possible easily
      }
      
      await productRef.set({
        ...productUpdate,
        history_count: incValue
      }, { merge: true });
      
      const historyRef = productRef.collection('price_history');
      await historyRef.add({
        ...historyData,
        createdAt: new Date()
      });
    } else {
      // Firebase Client SDK
      const productRef = doc(targetDb, targetCollection, productId);
      await setDoc(productRef, {
        ...productUpdate,
        history_count: increment(1)
      }, { merge: true });
      
      const historyRef = collection(targetDb, targetCollection, productId, 'price_history');
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
