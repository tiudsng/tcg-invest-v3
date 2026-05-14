import express from "express";
import cors from "cors";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, query, where, orderBy, limit, getDocs, getFirestore } from "firebase/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { Firestore } from "@google-cloud/firestore";
import * as fs from "fs";
import type { DocumentData, Query } from "firebase/firestore";

// Load SA from environment variable (Vercel) or fallback to local file (local dev)
// Vercel sets FIREBASE_ADMIN_SA_JSON as encrypted env var — never write to git
const getServiceAccount = () => {
  const envSA = process.env.FIREBASE_ADMIN_SA_JSON;
  if (envSA) {
    return JSON.parse(envSA);
  }
  // Local dev fallback — file gitignored
  return JSON.parse(fs.readFileSync('./firebase-admin-sa.json', 'utf8'));
};

// ─── Firebase Public Config (Client-Side Init) ─────────────────────────────────
// GET /api/config
// Returns Firebase client config for前端 initialization.
// Frontend reads this instead of hardcoding firebase-applet-config.json.
app.get('/api/config', (req, res) => {
  res.json({
    firebase: {
      apiKey:            process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDSwhKXm7KqaHVO2kb2PQ6qmarySPcZyJ0',
      authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0326385388.firebaseapp.com',
      projectId:         process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0326385388',
      storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0326385388.firebasestorage.app',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '122336191579',
      appId:             process.env.VITE_FIREBASE_APP_ID || '1:122336191579:web:2de07c0acb51b8b24c8b7e',
      firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b',
    },
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

const serviceAccount = getServiceAccount();

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

      // Send Telegram notification directly
      const botToken = process.env.TELEGRAM_BOT_TOKEN?.replace(/['"]/g, '').trim();
      const adminChatId = process.env.ADMIN_CHAT_ID;
      let notified = false;

      if (botToken && adminChatId) {
        try {
          await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: adminChatId,
            text: message,
            parse_mode: 'Markdown',
          });
          notified = true;
          console.log(`[MissCard] Telegram notification sent to ${adminChatId}`);
        } catch (notifyErr: any) {
          console.warn('[MissCard] Telegram notification failed:', notifyErr.message);
        }
      } else {
        console.warn('[MissCard] Missing TELEGRAM_BOT_TOKEN or ADMIN_CHAT_ID');
      }

      res.json({ success: true, found: true, data: result, notified });
    } else {
      res.json({ success: true, found: false, error: result.error });
    }
  } catch (error: any) {
    console.error("[MissCard] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Price History API (for recharts / ApexCharts) ────────────────────────────

const db = new Firestore({
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b',
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});

/**
 * GET /api/price-history/:snkrdunkId
 *
 * Returns price_history subcollection as chart-ready array:
 *   [{ date: '05-13', price: 1342, timestamp: '...' }, ...]
 *
 * Query params:
 *   days=N     — limit to last N days (default: 30)
 *   source=... — filter by source (e.g. 'snkrdunk_batch')
 */
app.get('/price-history/:snkrdunkId', async (req, res) => {
  try {
    const { snkrdunkId } = req.params;
    const { days = '30', source } = req.query;

    const cutoff = new Date(Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000);

    const productDocId = `snkrdunk_${snkrdunkId}`;
    const historyRef = db.collection('products').doc(productDocId).collection('price_history');

    let q: any = historyRef
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(200);

    if (source) {
      q = historyRef
        .where('createdAt', '>=', cutoff)
        .where('source', '==', source)
        .orderBy('createdAt', 'asc')
        .limit(200);
    }

    const snap = await q.get();

    // ── Forward-fill nulls (Stale-While-Revalidate gap fill) ──────────────────
    // If a scrape failed or returned null, carry forward the last known price.
    // This prevents chart cliffs/gaps when data is sparse.
    const rawData = snap.docs.map((doc: any) => {
      const d = doc.data();
      const date: Date = d.createdAt?.toDate?.() ?? new Date(d.createdAt);
      return {
        date: date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
        price: d.psa10_price ?? null,
        rawPrice: d.raw_price ?? null,
        timestamp: date.toISOString(),
        source: d.source ?? null,
        _filled: false,
      };
    });

    // Forward-fill gaps
    let lastPrice: number | null = null;
    let lastRawPrice: number | null = null;
    const data = rawData.map((d: any) => {
      if (d.price === null && lastPrice !== null) {
        d.price = lastPrice;
        d._filled = true;
      }
      if (d.rawPrice === null && lastRawPrice !== null) {
        d.rawPrice = lastRawPrice;
      }
      if (d.price !== null) lastPrice = d.price;
      if (d.rawPrice !== null) lastRawPrice = d.rawPrice;
      return d;
    });

    // ── Currency normalization (SGD → HKD via static rate) ───────────────────
    // Rate: 1 SGD ≈ 5.96 HKD (approximate, update as needed)
    const SGD_TO_HKD = 5.96;
    const targetCurrency = (req.query.currency as string)?.toUpperCase() ?? 'SGD';

    if (targetCurrency === 'HKD') {
      for (const d of data) {
        if (d.price !== null) d.price = Math.round(d.price * SGD_TO_HKD);
        if (d.rawPrice !== null) d.rawPrice = Math.round(d.rawPrice * SGD_TO_HKD);
      }
    }

    // Strip _filled internal flag before sending to client
    const cleanData = data.map((d: any) => {
      const { _filled, ...rest } = d;
      return rest;
    });

    // ── Stats (use filled data for accurate min/max) ─────────────────────────
    const filledPrices = cleanData
      .filter((d: any) => d.price !== null)
      .map((d: any) => d.price as number);
    const stats = filledPrices.length > 0 ? {
      current: filledPrices[filledPrices.length - 1],
      min: Math.min(...filledPrices),
      max: Math.max(...filledPrices),
      change: filledPrices.length >= 2 ? filledPrices[filledPrices.length - 1] - filledPrices[0] : 0,
      changePct: filledPrices.length >= 2
        ? Math.round(((filledPrices[filledPrices.length - 1] - filledPrices[0]) / filledPrices[0]) * 10000) / 100 : 0,
      currency: targetCurrency,
    } : null;

    res.json({
      success: true,
      cardId: snkrdunkId,
      docPath: `products/${productDocId}`,
      data: cleanData,
      stats,
      count: cleanData.length,
      filledCount: data.filter((d: any) => d._filled).length,
    });
  } catch (error: any) {
    console.error('[PriceHistory] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
