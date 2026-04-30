import express from "express";
import cors from "cors";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/**
 * Miss Card Search Service (inline)
 * 當 products collection 搵唔到卡時，爬 SNKRDUNK + PokecaChart 搵
 */
interface SearchResult {
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

async function searchSnkrdunk(keyword: string): Promise<Partial<SearchResult>> {
  try {
    // Try SNKRDUNK HTML search page
    const searchUrl = `https://snkrdunk.com/en/trading-cards/search?q=${encodeURIComponent(keyword)}&category=pokemon`;
    const response = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });
    
    const html = response.data as string;
    
    // Try JSON embedded in page
    const jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/s);
    if (jsonMatch) {
      try {
        const state = JSON.parse(jsonMatch[1]);
        const products = state?.products || state?.search?.products || state?.items || [];
        if (products.length > 0) {
          const first = products[0];
          return {
            found: true, source: 'snkrdunk',
            snkrdunk_id: first.id || first.productId,
            snkrdunk_url: `https://snkrdunk.com/en/trading-cards/${first.id || first.productId}/used`,
            card_name: first.name || first.title,
            card_number: first.cardNumber || first.productCode,
            set_code: first.setCode || first.brand,
          };
        }
      } catch {}
    }
    
    // Fallback: try to find card URLs in HTML
    const cardLinkMatch = html.match(/href="(\/en\/trading-cards\/[^"]+)"/);
    if (cardLinkMatch) {
      const path = cardLinkMatch[1];
      const idMatch = path.match(/\/en\/trading-cards\/([^/]+)/);
      if (idMatch) {
        return { found: true, source: 'snkrdunk', snkrdunk_id: idMatch[1], snkrdunk_url: `https://snkrdunk.com${path}` };
      }
    }
    
    return { found: false };
  } catch (e: any) {
    return { found: false, error: e.message };
  }
}

async function searchPokecaChart(keyword: string): Promise<Partial<SearchResult>> {
  try {
    // Use pokemon-card.com API (server-friendly)
    const searchUrl = `https://www.pokemon-card.com/card-search/resultAPI.php?keyword=${encodeURIComponent(keyword)}&page=1`;
    const response = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    
    const data = response.data;
    if (data && data.cardList && data.cardList.length > 0) {
      const first = data.cardList[0];
      // Build pokeca URL from card data
      // Card IDs are numeric, need to convert to pokeca slug format
      const cardId = first.cardID;
      const cardName = first.cardNameViewText || first.cardNameAltText;
      // For now, just return the card info - user can search manually
      return {
        found: true, source: 'pokeca',
        pokeca_url: null, // No direct URL without knowing the set/card format
        card_name: cardName,
        card_number: cardId,
        set_code: null,
      };
    }
    
    return { found: false };
  } catch (e: any) {
    return { found: false, error: e.message };
  }
}

async function searchMissingCard(keyword: string): Promise<SearchResult> {
  const [snkrdunk, pokeca] = await Promise.all([searchSnkrdunk(keyword), searchPokecaChart(keyword)]);
  if (snkrdunk.found) return snkrdunk as SearchResult;
  if (pokeca.found) return pokeca as SearchResult;
  return { found: false, source: null, error: snkrdunk.error || pokeca.error || 'No results' };
}

// API routes
app.get("/api/search", async (req, res) => {
  try {
    const { keyword, page } = req.query;
    const params = new URLSearchParams({
      keyword: (keyword as string) || "",
      sm_and_keyword: "true",
      regulation_sidebar_form: "all",
      page: (page as string) || "1",
    });

    const response = await axios.get(
      `https://www.pokemon-card.com/card-search/resultAPI.php?${params.toString()}`
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching from Pokemon Card API:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Report missing card → search SNKRDUNK + PokecaChart, notify admin
app.post("/api/report-missing-card", async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: "Missing keyword" });

    console.log(`[MissCard] Searching for: ${keyword}`);
    const result = await searchMissingCard(keyword);

    if (result.found) {
      let message = `🔍 *Miss Card Alert*\n\n`;
      message += `*Search:* ${keyword}\n`;
      if (result.card_name) message += `*Card:* ${result.card_name}\n`;
      if (result.card_number) message += `*Number:* ${result.card_number}\n`;
      if (result.set_code) message += `*Set:* ${result.set_code}\n`;
      message += `\n`;
      if (result.snkrdunk_url) message += `• SNKRDUNK: ${result.snkrdunk_url}\n`;
      if (result.pokeca_url) message += `• PokecaChart: ${result.pokeca_url}\n`;
      message += `\n_Source: ${result.source}_`;

      // Send Telegram notification via unified function
      const { sendAdminNotification } = await import('../src/bot.ts');
      const notified = await sendAdminNotification(message);

      res.json({ success: true, found: true, data: result, notified });
    } else {
      res.json({ success: true, found: false, error: result.error });
    }
  } catch (error: any) {
    console.error("[MissCard] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
