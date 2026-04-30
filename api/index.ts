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
    // Try to scrape SNKRDUNK search page HTML
    const searchUrl = `https://snkrdunk.com/en/trading-cards/search?q=${encodeURIComponent(keyword)}&category=pokemon`;
    const response = await axios.get(searchUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });
    
    const html = response.data as string;
    
    // Try to find card links from HTML
    // SNKRDUNK uses data attributes or JSON embedded in page
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
        return {
          found: true, source: 'snkrdunk',
          snkrdunk_id: idMatch[1],
          snkrdunk_url: `https://snkrdunk.com${path}`,
        };
      }
    }
    
    return { found: false };
  } catch (e: any) {
    return { found: false, error: e.message };
  }
}

async function searchPokecaChart(keyword: string): Promise<Partial<SearchResult>> {
  try {
    const searchUrl = `https://pokeca-chart.com/?search_word=${encodeURIComponent(keyword)}`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000,
    });
    const html = response.data as string;
    const match = html.match(/href="(\/card\/[^"]+)"/);
    if (match) {
      return { found: true, source: 'pokeca', pokeca_url: `https://pokeca-chart.com${match[1]}` };
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

      const adminChatId = process.env.ADMIN_CHAT_ID;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (adminChatId && botToken) {
        try {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: adminChatId,
            text: message,
            parse_mode: 'Markdown',
          });
          console.log(`[MissCard] Telegram notification sent to ${adminChatId}`);
        } catch (notifyErr: any) {
          console.warn('[MissCard] Telegram notification failed:', notifyErr.message);
        }
      } else {
        console.log('[MissCard] ADMIN_CHAT_ID or TELEGRAM_BOT_TOKEN not set, skipping notification');
      }

      res.json({ success: true, found: true, data: result, notified: !!(adminChatId && botToken) });
    } else {
      res.json({ success: true, found: false, error: result.error });
    }
  } catch (error: any) {
    console.error("[MissCard] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
