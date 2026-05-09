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
  // Priority: market_data.psa10_price_hkd -> data.psa10_hkd -> marketData.psa10_price (if parsed as HKD)
  let snkrdunkPrice = parsePriceToHkd(
    marketData.snkrdunk_price_hkd || 
    marketData.psa10_price_hkd || 
    data.psa10_hkd || 
    marketData.snkrdunk_price || 
    marketData.snkdunk_price || 
    data.snkrdunk_price || 
    data.price || 
    0
  );

  let ebayPrice = parsePriceToHkd(marketData.ebay_price_hkd || marketData.ebay_price || data.ebay_price || data.price || 0);
  
  // Specifically for PSA10 and Raw prices which might be in JPY in the raw market_data
  // V2 schema: market_data.psa10_price_jpy, market_data.raw_price_jpy
  const psa10Price = parsePriceToHkd(
    marketData.psa10_price_hkd || 
    marketData.psa10_price || // fallback to JPY if not in HKD
    data.psa10_hkd || 
    0
  );
  
  // raw_price: V2 stores raw_price_jpy, need to convert to HKD
  // Priority: raw_price_hkd -> raw_price (if HKD) -> raw_price_jpy (convert from JPY)
  let rawPrice = parsePriceToHkd(marketData.raw_price_hkd || marketData.raw_price || 0);
  if (rawPrice === 0) {
    // Fallback to JPY and convert
    // V2 stores raw_price_jpy as a NUMBER (580000 yen), not a currency string
    // parsePriceToHkd only detects currency from string format, so we need explicit JPY conversion
    const rawPriceJpy = marketData.raw_price_jpy || data.raw_price_jpy || 0;
    if (rawPriceJpy && typeof rawPriceJpy === 'number' && rawPriceJpy > 0) {
      rawPrice = Math.round(rawPriceJpy * 0.052); // JPY to HKD
    } else {
      rawPrice = parsePriceToHkd(rawPriceJpy);
    }
  }
  
  // Keep raw prices for secondary display if needed
  const psa10PriceJpy = marketData.psa10_price_jpy || marketData.psa10_price || 0;
  const rawPriceJpy = marketData.raw_price_jpy || marketData.raw_price || 0;
  
  const change24h = marketData.change_24h || data.change_24h || '0%';
  const status = marketData.status || data.status || 'stable';
  
  // Safe number parsing for population
  const parsePopCount = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseInt(val.replace(/,/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // V2 leaderboard schema: data.psa_data contains population stats
  const psaData = data.psa_data || {};
  const psa10Population = parsePopCount(
    marketData.psa_pop_10 || marketData.psa10_population || 
    data.psa_pop_10 || data.psa10_population ||
    psaData.psa10_count || // V2 field name
    0
  );
  const psaPopTotal = parsePopCount(
    marketData.psa_pop_total || data.psa_pop_total ||
    psaData.total_graded || // V2 field name
    0
  );
  
  // V2 PSA ratio - prefer string ratio from V2 over computed
  let psaPop10Percent = marketData.psa_pop_10_percent || data.psa_pop_10_percent || psaData.psa10_ratio;
  if (!psaPop10Percent && psaPopTotal > 0 && psa10Population > 0) {
    psaPop10Percent = `${((psa10Population / psaPopTotal) * 100).toFixed(1)}%`;
  }
  if (!psaPop10Percent || psaPop10Percent === '0%') {
    if (psa10Population > 0 && psaPopTotal > 0) {
       psaPop10Percent = `${((psa10Population / psaPopTotal) * 100).toFixed(1)}%`;
    } else {
       psaPop10Percent = '0%';
    }
  }

  return {
    ...marketData,
    snkrdunk_price: snkrdunkPrice,
    ebay_price: ebayPrice,
    psa10_price: psa10Price,
    raw_price: rawPrice,
    psa10_price_jpy: psa10PriceJpy,
    raw_price_jpy: rawPriceJpy,
    psa10_population: psa10Population,
    psa_pop_10: psa10Population,
    psa_pop_total: psaPopTotal,
    psa_pop_10_percent: psaPop10Percent,
    change_24h: change24h,
    status: status,
    last_updated: marketData.last_updated || data.last_updated || data.updatedAt
  };
};
