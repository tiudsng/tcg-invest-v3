import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
// Lazy import vite only in development
// import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { db as dbClient } from "./src/firebase.ts";
import { adminDb } from "./src/firebase-admin.ts";
import fs from "fs";
import { scrapeSnkrdunkMarketStats, searchSnkrdunk, searchPokecaChart } from "./src/lib/snkrdunkSearchService.js";
import { syncLeaderboard, syncSingleCard } from "./src/lib/leaderboardService.js";
import { startBot, sendAdminNotification } from "./src/bot.js";
import { collection, getDocs, doc, setDoc, addDoc, getDoc } from "firebase/firestore";

async function startServer() {
  console.log("!!! SERVER STARTING - V2.2 - (SCRAPINGBEE REMOVED) !!!");
  const rawKey = process.env.GEMINI_API_KEY || "";
  const GEMINI_API_KEY = rawKey.replace(/['"]/g, '').trim();
  
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

  app.get("/api/fix-leaderboard", async (req, res) => {
    try {
      const { getDoc, setDoc, doc } = await import("firebase/firestore");
      const { baselineData } = await import("./src/lib/leaderboardService.js");
      const { db } = await import("./src/firebase.js");

      const configD = await getDoc(doc(db, 'config', 'leaderboard'));
      const rankings = configD.data()?.rankings || [];
      
      const results = [];
      for (let i = 0; i < Math.min(rankings.length, 10); i++) {
        const snkrdunkId = rankings[i];
        const rankNum = i + 1;
        const rankKey = `rank_${rankNum.toString().padStart(2, '0')}`;
        
        const d = await getDoc(doc(db, 'leaderboard', rankKey));
        let data = d.exists() ? d.data() : {};
        
        if (!data.name_zh || !data.rank || !data.card_id) {
           const base = baselineData.find(b => b.id === rankKey) || baselineData[0];
           const p = await getDoc(doc(db, 'products', snkrdunkId));
           const pData = p.exists() ? p.data() : null;
           
           data.id = rankKey;
           data.rank = rankNum;
           data.card_id = snkrdunkId;
           data.name_zh = pData?.name_zh || pData?.name || base.name_zh;
           data.name_jp = pData?.name_jp || base.name_jp;
           data.card_number = pData?.card_number || base.card_number;
           data.set_name = pData?.set_name || base.set_name;
           data.set_code = pData?.set_code || base.set_code;
           data.image_url = pData?.image_url || base.image_url;
           
           await setDoc(doc(db, 'leaderboard', rankKey), data, { merge: true });
           results.push(`Fixed ${rankKey} -> ${data.name_zh}`);
        } else {
           results.push(`OK ${rankKey} -> ${data.name_zh}`);
        }
      }
      res.json({ status: "ok", results });
    } catch(e) {
      res.json({ error: String(e) });
    }
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
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "Missing or invalid snkrdunk ID" });
      }

      const stats = await scrapeSnkrdunkMarketStats(id);
      
      const rateMap: Record<string, number> = { "US $": 150, "SG $": 110, "¥": 1 };
      const cur = stats.currency.trim();
      const conversionRate = rateMap[cur] || 150;
      const psa10_jpy = stats.median_sold_psa10 ? Math.round(stats.median_sold_psa10 * conversionRate) : null;
      const raw_jpy = null;

      res.json({
        id,
        url: `https://snkrdunk.com/en/trading-cards/${id.replace('snkrdunk_', '')}/used`,
        data: {
          psa10_jpy,
          raw_jpy,
          extraction_method: stats.method,
          stats
        }
      });

    } catch (error: any) {
      console.error("[Scraper API] Error:", error.message);
      res.status(500).json({ error: "Failed to scrape snkrdunk" });
    }
  });

  app.post("/api/analyze-image", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Missing image" });

      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "伺服器未配置 GEMINI_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const base64Data = image.split(",")[1] || image;
      const mimeType = image.split(";")[0].split(":")[1] || "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
      console.log("[SyncTask] Starting full leaderboard sync on backend...");
      
      // Use adminDb for server-side updates
      await syncLeaderboard((msg) => {
        console.log(`[SyncProgress] ${msg}`);
      }, adminDb, GEMINI_API_KEY);

      res.json({ success: true, message: "排行榜同步完成" });
    } catch (error: any) {
      console.error("[SyncTask] Critical failure:", error);
      res.status(500).json({ error: error.message || "同步過程出錯" });
    }
  });

  app.post("/api/update-psa-pop", async (req, res) => {
    try {
      console.log("[PSA Pop] v2.1 Starting bulk update (No ScrapingBee)...");
      
      const productsSnap = await adminDb.collection('products').get();
      
      // Also fetch leaderboard to sync it
      const leaderboardSnap = await adminDb.collection('leaderboard').get();
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
                  const cleanedApiKey = process.env.GEMINI_API_KEY.replace(/['"]/g, '').trim();
                  const ai = new GoogleGenAI({ apiKey: cleanedApiKey });
                  const prompt = `Search for the latest official PSA Population data for the Pokemon TCG card: "${cardName}" with number "${cardNumber}". Provide JSON ONLY: { "psa_pop_total": number, "psa_pop_10": number }`;
                  const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt
                  });
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
              await adminDb.collection('products').doc(cardDocId).set({
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
                
                await adminDb.collection('leaderboard').doc(rankId).set({
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
      
      console.log(`[SyncTask] Syncing single card: ${rankKey} -> ${cardId}`);
      
      const result = await syncSingleCard(rankKey, cardId, adminDb, GEMINI_API_KEY);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("[SyncTask] Single card failure:", error);
      res.status(500).json({ error: error.message || "同步單卡出錯" });
    }
  });

  // New endpoint to handle missing card search on Snkrdunk and notify admin
  app.post("/api/report-missing-card", async (req, res) => {
    try {
      const { keyword } = req.body;
      if (!keyword) return res.status(400).json({ error: "Missing keyword" });

      console.log(`[MissingCard] User reported missing card: ${keyword}`);
      
      // Save to Firestore logs using client dbClient (rules allow write)
      try {
        const reportData = {
          keyword,
          createdAt: new Date().toISOString(),
          status: 'pending'
        };
        
        await addDoc(collection(dbClient, 'missing_reports'), reportData);
        console.log(`[MissingCard] Report saved to Firestore for: ${keyword}`);
      } catch (dbErr) {
        console.error("[MissingCard] Failed to log to Firestore (using dbClient):", dbErr);
      }

      // Return response immediately so frontend doesn't hang
      res.json({ success: true, count: 0, data: [] });

      // Run Telegram notification and scraping in background
      (async () => {
        try {
          console.log(`[MissingCard] Searching Snkrdunk and PokecaChart in background for: ${keyword}`);
          
          const snkrdunkSearchUrl = `https://snkrdunk.com/search/result?keyword=${encodeURIComponent(keyword)}`;
          
          const [snkrdunkResults, pokecaResults] = await Promise.all([
            searchSnkrdunk(keyword).catch(e => { console.error(e); return [] as any[]; }),
            searchPokecaChart(keyword).catch(e => { console.error(e); return [] as any[]; })
          ]);

          let message = `🚨 *Missing Card Report*\n\nUser searched for a missing card:\n*Keyword:* \`${keyword}\`\n\n`;
          message += `🔗 [Search directly on Snkrdunk](${snkrdunkSearchUrl})\n\n`;

          if (snkrdunkResults.length > 0) {
            message += `*Snkrdunk Results:* \n`;
            snkrdunkResults.slice(0, 3).forEach((item: any, index: number) => {
              message += `${index + 1}. [${item.name}](${item.url}) \n`;
              message += `   ID: \`${item.id}\` \n`;
            });
          }
          
          if (pokecaResults.length > 0) {
            message += `\n*Pokeca-Chart Results:* \n`;
            pokecaResults.slice(0, 3).forEach((item: any, index: number) => {
              message += `${index + 1}. [${item.name}](${item.url}) \n`;
              message += `   Slug: \`${item.slug}\` \n`;
            });
          }

          if (snkrdunkResults.length === 0 && pokecaResults.length === 0) {
             message += `_No auto-extracted results found._\n`;
          }

          await sendAdminNotification(message);
          console.log(`[MissingCard] Background notification sent for: ${keyword}`);
        } catch (e) {
             console.error(`[MissingCard] Background task failed:`, e);
        }
      })();
    } catch (error: any) {
      console.error("[MissingCard] Route Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start Unified Telegram Bot
  try {
    startBot().catch(err => console.error("Async Bot Error:", err));
  } catch (err) {
    console.error("Failed to start Telegraf bot:", err);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          allowedHosts: true as any,
          hmr: process.env.DISABLE_HMR !== 'true'
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to start Vite Server", e);
    }
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      distPath = process.cwd(); // Fallback if we are running inside the dist/build folder
    }
    console.log(`[Server] Serving static files from: ${distPath}`);
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
