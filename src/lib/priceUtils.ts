// src/lib/priceUtils.ts
export const cleanMarketData = (cardId: string, data: any) => {
  const marketData = (data.market_data || {}) as any;
  
  // Normalize prices
  let snkrdunkPrice = data.psa10_hkd || marketData.snkrdunk_price || marketData.snkdunk_price || data.snkrdunk_price || data.price || 0;
  let ebayPrice = marketData.ebay_price || data.ebay_price || data.price || 0;
  const psa10Price = marketData.psa10_price || 0;
  const rawPrice = marketData.raw_price || 0;
  const change24h = marketData.change_24h || data.change_24h || '0%';
  const status = marketData.status || data.status || 'stable';

  // Apply auto-fix JPY -> HKD conversion for known outliers
  if (cardId === 'ion_sar' || data.name_zh?.includes('噴火龍 ex SAR')) {
    if (ebayPrice > 10000) ebayPrice = Math.round(ebayPrice * 0.051);
    if (snkrdunkPrice > 10000) snkrdunkPrice = Math.round(snkrdunkPrice * 0.051);
  }

  return {
    snkrdunk_price: snkrdunkPrice,
    ebay_price: ebayPrice,
    psa10_price: psa10Price,
    raw_price: rawPrice,
    change_24h: change24h,
    status: status
  };
};
