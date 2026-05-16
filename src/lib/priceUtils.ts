// src/lib/priceUtils.ts

export const parsePriceToHkd = (val: string | number | undefined | null): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    // Plain numbers default to JPY (source systems return JPY)
    // Only apply conversion for large values (JPY range), small values already HKD
    if (val >= 1000) {
      return Math.round(val * 0.052); // JPY to HKD
    }
    return val;
  }
  
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
  
  // No currency marker found: treat as JPY if value looks like JPY (>=1000)
  if (cleaned >= 1000) {
    return Math.round(cleaned * 0.052); // JPY to HKD
  }
  // Small values already HKD
  return Math.round(cleaned);
};

export const cleanMarketData = (cardId: string, data: any) => {
  const marketData = (data.market_data || {}) as any;
  
  // Normalize prices to numbers (HKD)
  // Priority: market_data.psa10_price_hkd -> data.psa10_hkd -> marketData.psa10_price (if parsed as HKD)
  // PSA10 and RAW prices are ALREADY in HKD (converted by scraper)
  // They are stored as plain numbers >= 1000 in market_data.psa10_price / market_data.raw_price
  // DO NOT pass through parsePriceToHkd again — that would double-convert (×0.052)
  // Only use parsePriceToHkd when source field name suggests it's a raw JPY value
  const getHkdPrice = (hkdField: string | number | undefined, jpyField: string | number | undefined): number => {
    if (typeof hkdField === 'number' && hkdField >= 1000) {
      // Already HKD — return directly
      return hkdField;
    }
    if (hkdField) return parsePriceToHkd(hkdField);
    if (jpyField) return parsePriceToHkd(jpyField);
    return 0;
  };

  const snkrdunkPrice = getHkdPrice(
    marketData.snkrdunk_price_hkd || marketData.snkrdunk_price,
    undefined
  );
  const ebayPrice = getHkdPrice(
    marketData.ebay_price_hkd || marketData.ebay_price,
    undefined
  );
  const psa10Price = getHkdPrice(
    marketData.psa10_price,
    marketData.psa10_latest_jpy
  );
  const rawPrice = getHkdPrice(
    marketData.raw_price,
    marketData.raw_latest_jpy
  );
  
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

  // PSA population: check market_data + data + psa_data (leaderboard uses psa_data.*)
  const psa10Population = parsePopCount(
    marketData.psa_pop_10 || marketData.psa10_population ||
    data.psa_pop_10 || data.psa10_population ||
    data.psa_data?.psa10_count  // leaderboard psa_data fallback
  );
  const psaPopTotal = parsePopCount(
    marketData.psa_pop_total || data.psa_pop_total ||
    data.psa_data?.total_graded  // leaderboard psa_data fallback
  );

  // PSA ratio: check market_data + data + psa_data.psa10_ratio
  let psaPop10Percent = marketData.psa_pop_10_percent || data.psa_pop_10_percent || data.psa_data?.psa10_ratio;
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
