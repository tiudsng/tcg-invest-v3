/**
 * Miss Card Search Service
 * 當 products collection 搵唔到卡時，爬 SNKRDUNK + PokecaChart 搵
 */

import axios from 'axios';

export interface SearchResult {
  found: boolean;
  source: 'snkrdunk' | 'pokeca' | null;
  snkrdunk_id?: string;
  snkrdunk_url?: string;
  pokeca_url?: string;
  card_name?: string;
  card_number?: string;
  set_code?: string;
  psa10_price_jpy?: number;
  raw_price_jpy?: number;
  error?: string;
}

/**
 * 從關鍵字推斷卡名，用於 SNKRDUNK 搜索
 */
function inferCardHints(keyword: string): { name: string; number?: string } {
  const kw = keyword.toLowerCase().trim();
  
  // 常用卡名 mapping
  const knownCards: Record<string, string> = {
    'gengar': 'Gengar ex',
    '耿鬼': 'Gengar ex',
    'charizard': 'Charizard ex',
    '噴火龍': 'Charizard ex',
    'mew': 'Mew ex',
    'mewtwo': 'Mewtwo',
    '夢幻': 'Mew',
    '超夢': 'Mewtwo',
    'pikachu': 'Pikachu',
    '皮卡丘': 'Pikachu',
    'lillie': 'Lillie',
    '莉莉艾': 'Lillie',
    'umbreon': 'Umbreon',
    '月伊布': 'Umbreon',
  };

  // 先還原常見卡名
  for (const [key, name] of Object.entries(knownCards)) {
    if (kw.includes(key)) {
      return { name };
    }
  }

  return { name: keyword };
}

/**
 * 搜索 SNKRDUNK
 */
export async function searchSnkrdunk(keyword: string): Promise<Partial<SearchResult>> {
  try {
    const hints = inferCardHints(keyword);
    
    // SNKRDUNK 搜索 API
    const searchUrl = `https://snkrdunk.com/en/trading-cards/search?q=${encodeURIComponent(hints.name)}&category=pokemon&page=1`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    const results = response.data?.results || response.data?.items || [];
    
    if (results.length > 0) {
      const first = results[0];
      return {
        found: true,
        source: 'snkrdunk',
        snkrdunk_id: first.id || first.snkrdunk_id,
        snkrdunk_url: `https://snkrdunk.com/en/trading-cards/${first.id || first.snkrdunk_id}/used`,
        card_name: first.name || first.title,
        card_number: first.card_number || first.product_code,
        set_code: first.set_code || first.brand,
      };
    }

    return { found: false };
  } catch (error: any) {
    console.warn('[SnkrdunkSearch] Error:', error.message);
    return { found: false, error: error.message };
  }
}

/**
 * 搜索 PokecaChart
 */
export async function searchPokecaChart(keyword: string): Promise<Partial<SearchResult>> {
  try {
    // PokecaChart 搜索頁面
    const searchUrl = `https://pokeca-chart.com/?search_word=${encodeURIComponent(keyword)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });

    const html = response.data as string;
    
    // 從 HTML 中提取卡片連結
    const cardLinkMatch = html.match(/href="(\/card\/[^"]+)"/);
    if (cardLinkMatch) {
      const pokecaUrl = cardLinkMatch[1];
      return {
        found: true,
        source: 'pokeca',
        pokeca_url: `https://pokeca-chart.com${pokecaUrl}`,
      };
    }

    return { found: false };
  } catch (error: any) {
    console.warn('[PokecaSearch] Error:', error.message);
    return { found: false, error: error.message };
  }
}

/**
 * 綜合搜索：同時試 SNKRDUNK 和 PokecaChart
 */
export async function searchMissingCard(keyword: string): Promise<SearchResult> {
  // 並行搜索兩個來源
  const [snkrdunkResult, pokecaResult] = await Promise.all([
    searchSnkrdunk(keyword),
    searchPokecaChart(keyword),
  ]);

  // 優先返回 SNKRDUNK 結果
  if (snkrdunkResult.found) {
    return snkrdunkResult as SearchResult;
  }

  // 否則返回 PokecaChart 結果
  if (pokecaResult.found) {
    return pokecaResult as SearchResult;
  }

  return {
    found: false,
    source: null,
    error: snkrdunkResult.error || pokecaResult.error || 'Both sources returned no results',
  };
}
