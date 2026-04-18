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
  const GEMINI_API_KEY = rawKey.replace(/['"]/g, '').trim();
  
  if (GEMINI_API_KEY) {
    const maskedKey = `${GEMINI_API_KEY.substring(0, 4)}...${GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4)}`;
    console.log(`GEMINI_API_KEY detected: ${maskedKey} (Length: ${GEMINI_API_KEY.length})`);
  } else {
    console.warn("⚠️ GEMINI_API_KEY is missing in process.env");
  }

  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

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
          // Thoroughly clean the API key (remove whitespace and any accidental quotes)
          const rawEnv = process.env.GEMINI_API_KEY || "";
          const currentKey = rawEnv.replace(/['"]/g, '').trim();
          
          console.log(`Telegram bot attempting with key length: ${currentKey.length}, starts with: ${currentKey.substring(0,4)}`);
          const aiClient = currentKey ? new GoogleGenAI({ apiKey: currentKey }) : null;

          if (!aiClient) {
            await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              chat_id: chatId,
              text: `⚠️ 系統未偵測到有效的 GEMINI_API_KEY (目前長度: ${currentKey.length})。請在 Settings > Secrets 中設定。🦞`
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
            const result = await aiClient.models.generateContent({
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
