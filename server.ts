import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { db as dbClient } from "./src/firebase.ts";
import fs from "fs";

async function startServer() {
  console.log("!!! SERVER STARTING - V2.2 - (SCRAPINGBEE REMOVED) !!!");
  const rawKey = process.env.GEMINI_API_KEY || "";
  const GEMINI_API_KEY = rawKey.trim();
  
  if (GEMINI_API_KEY && GEMINI_API_KEY.length > 20) {
    const maskedKey = `${GEMINI_API_KEY.substring(0, 4)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`;
    console.log(`[Server] GEMINI_API_KEY detected: ${maskedKey} (Length: ${GEMINI_API_KEY.length})`);
  } else {
    console.warn("[Server] ⚠️ GEMINI_API_KEY is missing or invalid in process.env");
  }

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Proxy for downloading images from official site to bypass CORS
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("No URL provided");
    
    try {
      const response = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.pokemon-card.com/'
        }
      });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.send(Buffer.from(response.data));
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to proxy image");
    }
  });

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

  // Snkrdunk Scraping Endpoint utilizing Puppeteer + Gemini
  app.get("/api/scrape-snkrdunk", async (req, res) => {
    let browser = null;
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing or invalid snkrdunk ID" });
      }

      // SNKRDUNK product URL
      const targetUrl = `https://snkrdunk.com/products/${id}`;

      console.log(`[Scraper] Fetching Snkrdunk via Puppeteer: ${targetUrl}`);
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 35000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      // Extract raw text
      const fullText = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript, svg, path, footer, nav').forEach(el => el.remove());
        return document.body.innerText.replace(/\s+/g, ' ');
      });

      // Try to find price via selectors first
      let psa10_jpy: number | null = null;
      let raw_jpy: number | null = null;

      const extractJpy = (pattern: RegExp) => {
        const match = fullText.match(pattern);
        if (match) {
          const val = match[1].replace(/,/g, '');
          return parseInt(val, 10);
        }
        return null;
      };

      // Patterns common for Snkrdunk card pages
      psa10_jpy = extractJpy(/(?:PSA10|PSA\s?10|鑑定品|鑑定済み|鑑定済).*?¥\s?([0-9,]+)/i);
      raw_jpy = extractJpy(/(?:新品|RAW|未鑑定|通常|未開封).*?¥\s?([0-9,]+)/i);

      // If still null, try general price extraction
      if (!psa10_jpy) {
        // Look for the first price if it's potentially PSA10
        const firstPrice = extractJpy(/¥\s?([0-9,]{3,})/);
        if (firstPrice) psa10_jpy = firstPrice;
      }

      const parsedData = {
        psa10_jpy,
        raw_jpy,
        extraction_method: "regex"
      };

      console.log(`[Scraper] Regex extraction success:`, parsedData);
      
      // Send result
      res.json({
        id,
        url: targetUrl,
        data: parsedData
      });

    } catch (error: any) {
      console.error("[Scraper] Error:", error.message);
      if (error.response) {
         console.error("[Scraper] Response details:", error.response.data);
      }
      res.status(500).json({ error: "Failed to scrape snkrdunk" });
    } finally {
      if (browser) await browser.close();
    }
  });

  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Missing image" });

      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "伺服器未配置 GEMINI_API_KEY" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const base64Data = image.split(",")[1] || image;
      const mimeType = image.split(";")[0].split(":")[1] || "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            text: `Identify this trading card from the image. 
          1. Find its exact card name and card number (e.g., 201/165).
          2. Search for the real, current market value of this specific card on reliable TCG market websites.
          3. Find the price for both PSA 10 condition and RAW (ungraded) condition.
          4. Return the results in Hong Kong Dollars (HKD).
          Return valid JSON only.`
          },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]
      });

      const resultText = response.text || "{}";
      const cleanedJson = resultText.replace(/```json|```/g, '');
      const data = JSON.parse(cleanedJson);
      res.json(data);
    } catch (error: any) {
      console.error("[AIScan] Error:", error.message);
      res.status(500).json({ error: error.message || "Failed to analyze image" });
    }
  });

  // Advanced sync endpoint: Handles scraping + AI analysis + Database write entirely on backend
  app.post("/api/sync-leaderboard", async (req, res) => {
    try {
      const { syncLeaderboard } = await import('./src/lib/leaderboardService');
      
      console.log("[SyncTask] Starting full leaderboard sync on backend...");
      
      // Use dbClient for server-side updates
      await syncLeaderboard((msg) => {
        console.log(`[SyncProgress] ${msg}`);
      }, dbClient, GEMINI_API_KEY);

      res.json({ success: true, message: "排行榜同步完成" });
    } catch (error: any) {
      console.error("[SyncTask] Critical failure:", error);
      res.status(500).json({ error: error.message || "同步過程出錯" });
    }
  });

  app.post("/api/update-psa-pop", async (req, res) => {
    try {
      console.log("[PSA Pop] v2.1 Starting bulk update (No ScrapingBee)...");
      
      const { collection, getDocs, query, where, doc, setDoc } = await import('firebase/firestore');
      const productsSnap = await getDocs(collection(dbClient, 'products'));
      
      // Also fetch leaderboard to sync it
      const leaderboardSnap = await getDocs(collection(dbClient, 'leaderboard'));
      const leaderboardMap = new Map(); // cardId -> rankId
      leaderboardSnap.docs.forEach(d => {
        const data = d.data();
        if (data.card_id) {
          leaderboardMap.set(data.card_id, d.id);
        }
      });

      let updated = 0;
      let failed = 0;
      
      // We'll process them in small batches or sequentially to avoid limits
      for (const docSnap of productsSnap.docs) {
        const cardDocId = docSnap.id;
        const data = docSnap.data();
        const cardName = data.name_zh || data.name_jp;
        const cardNumber = data.card_number;
        
        if (!cardName || !cardNumber) {
           failed++;
           continue;
        }

        try {
           let psaPopTotal = 0;
           let psaPop10 = 0;

           // Rely on AI for PSA Population as regular scraping is blocked
           if (process.env.GEMINI_API_KEY) {
              try {
                  const { GoogleGenAI } = await import("@google/genai");
                  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
                  const prompt = `Search for the latest official PSA Population data for the Pokemon TCG card: "${cardName}" with number "${cardNumber}". Provide JSON ONLY: { "psa_pop_total": number, "psa_pop_10": number }`;
                  const response = await ai.models.generateContent({ model: "gemini-flash-latest", contents: prompt });
                  const result = JSON.parse((response.text||"").replace(/```json|```/g, '') || '{}');
                  if (result.psa_pop_total) psaPopTotal = result.psa_pop_total;
                  if (result.psa_pop_10) psaPop10 = result.psa_pop_10;
              } catch (aiErr: any) {
                  console.warn(`[PSA Pop] AI lookup failed for ${cardName}: ${aiErr.message}`);
              }
           }

           if (psaPopTotal && psaPop10) {
              const newPsaData = {
                psa_pop_total: psaPopTotal,
                psa_pop_10: psaPop10,
                psa_pop_10_percent: ((psaPop10 / psaPopTotal) * 100).toFixed(1) + '%'
              };

              // Update Products
              await setDoc(doc(dbClient, 'products', cardDocId), {
                market_data: {
                  ...(data.market_data || {}),
                  ...newPsaData
                }
              }, { merge: true });

              // Update Leaderboard if card exists there
              if (leaderboardMap.has(cardDocId)) {
                const rankId = leaderboardMap.get(cardDocId);
                const rankDoc = leaderboardSnap.docs.find(d => d.id === rankId);
                const rankData = rankDoc?.data() || {};
                
                await setDoc(doc(dbClient, 'leaderboard', rankId), {
                  market_data: {
                    ...(rankData.market_data || {}),
                    ...newPsaData
                  }
                }, { merge: true });
                console.log(`[PSA Pop] Updated Leaderboard entry: ${rankId} for ${cardDocId}`);
              }

              updated++;
           } else {
              failed++;
           }
        } catch (e: any) {
           console.warn(`[PSA Pop] Failed for ${cardName}: ${e.message}`);
           failed++;
        }
      }

      console.log(`[PSA Pop] Finished. Updated: ${updated}, Failed: ${failed}`);
      res.json({ success: true, total: productsSnap.size, updated, failed });
    } catch (error: any) {
      console.error("[PSA Pop] Fatal error:", error);
      res.status(500).json({ error: error.message || "同步過程出錯" });
    }
  });

  // Sync a single card: Used by frontend to avoid aggregate timeout
  app.post("/api/sync-single-card", async (req, res) => {
    try {
      const { rankKey, cardId } = req.body;
      if (!rankKey || !cardId) return res.status(400).json({ error: "Missing rankKey or cardId" });

      if (!GEMINI_API_KEY) {
        console.warn("[SyncTask] Notice: GEMINI_API_KEY is not configured. Sync will proceed without AI analysis.");
      }
      
      const { syncSingleCard } = await import('./src/lib/leaderboardService.ts');
      console.log(`[SyncTask] Syncing single card: ${rankKey} -> ${cardId} (Key: ${GEMINI_API_KEY.substring(0, 5)}...)`);
      
      const result = await syncSingleCard(rankKey, cardId, dbClient, GEMINI_API_KEY);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[SyncTask] Single card failure:", error);
      res.status(500).json({ error: error.message || "同步單卡出錯" });
    }
  });

  // Report missing card → search SNKRDUNK + PokecaChart, notify admin
  app.post("/api/report-missing-card", async (req, res) => {
    try {
      const { keyword, chat_id } = req.body;
      if (!keyword) return res.status(400).json({ error: "Missing keyword" });

      console.log(`[MissCard] Searching for: ${keyword}`);

      // Dynamic import to avoid circular deps
      const { searchMissingCard } = await import('./src/lib/snkrdunkSearchService.ts');
      const { sendAdminNotification } = await import('./src/bot.ts');
      const result = await searchMissingCard(keyword);

      if (result.found) {
        // Build notification message
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
        const notified = await sendAdminNotification(message, chat_id);

        res.json({ success: true, found: true, data: result, notified });
      } else {
        res.json({ success: true, found: false, error: result.error });
      }
    } catch (error: any) {
      console.error("[MissCard] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start Unified Telegram Bot
  try {
    const { startBot } = await import('./src/bot.ts');
    startBot().catch(err => console.error("Async Bot Error:", err));
  } catch (err) {
    console.error("Failed to start Telegraf bot:", err);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          allowedHosts: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { port: 24678 }
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to start Vite Server", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`🚀 [Server] Node Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ [Server] Port ${PORT} is already in use.`);
    } else {
      console.error(`❌ [Server] Listen error:`, err);
    }
  });
}

startServer();
