import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Load configuration
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : null;

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig?.projectId
    });
    console.log("Firebase Admin initialized");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

const dbAdmin = getFirestore(admin.app(), firebaseConfig?.firestoreDatabaseId);

async function startServer() {
  const rawKey = process.env.GEMINI_API_KEY || "";
  const GEMINI_API_KEY = rawKey.trim();
  
  if (GEMINI_API_KEY) {
    const maskedKey = `${GEMINI_API_KEY.substring(0, 4)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`;
    console.log(`GEMINI_API_KEY detected: ${maskedKey} (Length: ${GEMINI_API_KEY.length})`);
    if (!GEMINI_API_KEY.startsWith("AIza")) {
      console.error("❌ GEMINI_API_KEY seems invalid (should start with 'AIza'). Please check your Settings > Secrets.");
    }
  } else {
    console.warn("⚠️ GEMINI_API_KEY is missing in process.env");
  }

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Initialize Gemini if key exists
  const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

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

  // Telegram Long Polling (Alternative to Webhook for restricted environments)
  let lastUpdateId = 0;
  let isPolling = false;

  async function pollTelegram() {
    if (!process.env.TELEGRAM_BOT_TOKEN || isPolling) return;
    isPolling = true;
    
    try {
      const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, {
        params: {
          offset: lastUpdateId + 1,
          timeout: 20
        }
      });

      const updates = response.data.result;
      for (const update of updates) {
        lastUpdateId = update.update_id;
        const message = update.message;
        if (!message || !message.text) continue;

        const chatId = message.chat.id;
        const text = message.text;

        console.log(`Polling: Received Telegram message: ${text}`);

        if (text.toLowerCase().includes("openclaw") || text.includes("小龍蝦")) {
          if (!ai) {
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: "⚠️ 系統未偵測到有效的 GEMINI_API_KEY。請在 Settings > Secrets 中設定。🦞"
            });
            continue;
          }

          try {
            const prompt = `
              User input: "${text}"
              You are "OpenClaw (小龍蝦)", a market analyst for Pokemon TCG.
              Based on the user's intent, decide what to do.
              Return a JSON object:
              {
                "action": "post_article" | "reply",
                "title": "Title (if post)",
                "content": "Full markdown (if post)",
                "category": "情報分析",
                "zone": 1 | 2 | 3 | 0,
                "reply": "Message back to telegram"
              }
              ONLY return the JSON.
            `;
            const result = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
            
            const responseText = result.text.trim().replace(/```json|```/g, "");
            let actionData;
            try {
              actionData = JSON.parse(responseText);
            } catch (e) {
              console.error("JSON Parse Error on Gemini response:", responseText);
              // Fallback for non-JSON response
              actionData = { action: "reply", reply: responseText };
            }

            if (actionData.action === "post_article") {
              const article = {
                title: actionData.title,
                content: actionData.content,
                category: actionData.category || "情報分析",
                zone: actionData.zone || 0,
                author: "OPENCLAW 小龍蝦",
                imageUrl: `https://picsum.photos/seed/${encodeURIComponent(actionData.title)}/1200/800`,
                readTime: `${Math.ceil(actionData.content.length / 500)} min read`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                featured: actionData.zone > 0
              };
              await dbAdmin.collection("articles").add(article);
            }

            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: actionData.reply || "發佈成功！🦞"
            });
          } catch (aiError: any) {
            console.error("Gemini AI Error:", aiError.message);
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: `AI 處理出錯: ${aiError.message}`
            });
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.warn("Telegram 409 Conflict: Another instance might be running. Waiting 5s...");
        isPolling = false;
        setTimeout(pollTelegram, 5000);
        return;
      }
      console.error("Polling Error:", error.message);
    }
    
    isPolling = false;
    setTimeout(pollTelegram, 2000);
  }

  // Start Polling if Token exists
  if (process.env.TELEGRAM_BOT_TOKEN) {
    pollTelegram();
    console.log("Telegram Polling started...");
  }

  // Auto-seed list_1 on startup if empty
  try {
    const list1Snap = await dbAdmin.collection('list_1').limit(1).get();
    if (list1Snap.empty) {
      console.log("Leaderboard collection is empty. Seeding initial data...");
      const leaderboardData = [
        {
          card_id: 'charizard_151_sar',
          rank: 1,
          name_zh: '噴火龍 ex (151 SAR)',
          name_jp: 'リザードンex',
          card_number: '201/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/201.png',
          market_data: { snkrdunk_price: 12500, ebay_price: 12500, change_24h: '+2.4%', status: 'up' }
        },
        {
          card_id: 'van_gogh_pikachu',
          rank: 2,
          name_zh: '梵高皮卡丘 (Promo)',
          name_jp: 'ゴッホ ピカチュウ',
          card_number: '085/SVP',
          set_name: 'Promo',
          image_url: 'https://images.pokemoncard.io/cards/svp/85.png',
          market_data: { snkrdunk_price: 8800, ebay_price: 8800, change_24h: '+5.1%', status: 'up' }
        },
        {
          card_id: 'mew_151_sar',
          rank: 3,
          name_zh: '夢幻 ex (泡泡 SAR)',
          name_jp: 'ミュウex',
          card_number: '205/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/205.png',
          market_data: { snkrdunk_price: 7200, ebay_price: 7200, change_24h: '+1.2%', status: 'up' }
        },
        {
          card_id: 'mewtwo_armor',
          rank: 4,
          name_zh: '武裝夢夢 (特典)',
          name_jp: 'アーマードミュウツー',
          card_number: '365/SM-P',
          set_name: 'SM-P Promo',
          image_url: 'https://images.pokemoncard.io/cards/smp/365.png',
          market_data: { snkrdunk_price: 4500, ebay_price: 4500, change_24h: '0.0%', status: 'stable' }
        },
        {
          card_id: 'umbreon_vmax_sa',
          rank: 5,
          name_zh: '月亮伊布 VMAX (SA)',
          name_jp: 'ブラッキーVMAX',
          card_number: '095/069',
          set_name: 'S6a Eevee Heroes',
          image_url: 'https://images.pokemoncard.io/cards/s6a/95.png',
          market_data: { snkrdunk_price: 18500, ebay_price: 18500, change_24h: '+0.5%', status: 'up' }
        },
        {
          card_id: 'lillie_determination_sv9',
          rank: 6,
          name_zh: '莉莉艾的決意 (Mega 2026)',
          name_jp: 'リーリエの全力',
          card_number: 'SV9 SAR',
          set_name: 'SV9',
          image_url: 'https://placehold.co/400x560/f8d7da/721c24?text=Lillie+SV9',
          market_data: { snkrdunk_price: 5800, ebay_price: 5800, change_24h: '+12.4%', status: 'up' }
        },
        {
          card_id: 'pikachu_ex_sv8a',
          rank: 7,
          name_zh: '皮卡丘 ex (超電突波 UR)',
          name_jp: 'ピカチュウex',
          card_number: '236/187',
          set_name: 'SV8a',
          image_url: 'https://images.pokemoncard.io/cards/sv8a/236.png',
          market_data: { snkrdunk_price: 3200, ebay_price: 3200, change_24h: '-2.1%', status: 'down' }
        },
        {
          card_id: 'gengar_masterball',
          rank: 8,
          name_zh: '耿鬼 (151 大師球閃)',
          name_jp: 'ゲンガー',
          card_number: '094/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/94.png',
          market_data: { snkrdunk_price: 2800, ebay_price: 2800, change_24h: '+1.8%', status: 'up' }
        },
        {
          card_id: 'ion_sar',
          rank: 9,
          name_zh: '奇樹 (SAR)',
          name_jp: 'ナンジャモ',
          card_number: '357/190',
          set_name: 'SV4a',
          image_url: 'https://images.pokemoncard.io/cards/sv4a/357.png',
          market_data: { snkrdunk_price: 1900, ebay_price: 1900, change_24h: '-0.5%', status: 'down' }
        },
        {
          card_id: 'charizard_y_sv9',
          rank: 10,
          name_zh: 'Mega 噴火龍 Y ex (SAR)',
          name_jp: 'メガリザードンY',
          card_number: 'SV9',
          set_name: 'SV9',
          image_url: 'https://placehold.co/400x560/1c1c1e/d4af37?text=Charizard+Y+SV9',
          market_data: { snkrdunk_price: 9500, ebay_price: 9500, change_24h: '+15.0%', status: 'up' }
        }
      ];
      const batch = dbAdmin.batch();
      leaderboardData.forEach(item => {
        batch.set(dbAdmin.collection('list_1').doc(item.card_id), {
          ...item,
          id: item.card_id
        });
      });
      await batch.commit();
      console.log("Auto-seed successful.");
    }
  } catch (error) {
    console.warn("Auto-seed failed (possibly expected if permissions same as CLI):", error);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
