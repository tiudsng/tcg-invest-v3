// src/lib/priceUtils.ts

export const parsePriceToHkd = (val: string | number | undefined | null): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  
  const strVal = String(val).toUpperCase();
  // match digits and optional decimals
  const match = strVal.replace(/,/g, '').match(/[0-9.]+/);
  if (!match) return 0;
  
  const cleaned = parseFloat(match[0]);
  if (isNaN(cleaned)) return 0;

  if (strVal.includes('SG') || strVal.includes('SGD')) {
    return Math.round(cleaned * 5.75); // SGD to HKD
  }
  if (strVal.includes('US')) {
    return Math.round(cleaned * 7.8); // USD to HKD 
  }
  if (strVal.includes('¥') || strVal.includes('YEN') || strVal.includes('JPY') || strVal.includes('円')) {
    return Math.round(cleaned * 0.052); // JPY to HKD
  }
  
  // Assume HKD if no specific currency match
  return Math.round(cleaned);
};

export const cleanMarketData = (cardId: string, data: any) => {
  const marketData = (data.market_data || {}) as any;
  
  // Normalize prices to numbers (HKD)
  let snkrdunkPrice = parsePriceToHkd(data.psa10_hkd || marketData.snkrdunk_price || marketData.snkdunk_price || data.snkrdunk_price || data.price || 0);
  let ebayPrice = parsePriceToHkd(marketData.ebay_price || data.ebay_price || data.price || 0);
  const psa10Price = parsePriceToHkd(marketData.psa10_price || 0);
  const rawPrice = parsePriceToHkd(marketData.raw_price || 0);
  
  const change24h = marketData.change_24h || data.change_24h || '0%';
  const status = marketData.status || data.status || 'stable';

  return {
    ...marketData,
    snkrdunk_price: snkrdunkPrice,
    ebay_price: ebayPrice,
    psa10_price: psa10Price,
    raw_price: rawPrice,
    change_24h: change24h,
    status: status
  };
};
