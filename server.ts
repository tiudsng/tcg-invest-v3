import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function startServer() {
  console.log("GEMINI_API_KEY exists in server:", !!process.env.GEMINI_API_KEY);
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API routes FIRST
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

  // AI Analysis route
  app.post("/api/ai/analyze", async (req, res) => {
    console.log("AI Analysis request received");
    try {
      const { image, prompt, schema } = req.body;
      if (!image) {
        console.error("No image provided in request");
        return res.status(400).json({ error: "No image provided" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Gemini API Key not configured on server");
        return res.status(500).json({ error: "Gemini API Key not configured on server" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        generationConfig: schema ? {
          responseMimeType: "application/json",
          responseSchema: schema
        } : undefined,
        tools: [{ googleSearch: {} }]
      });

      const base64Data = image.split(",")[1] || image;
      const mimeType = image.split(";")[0].split(":")[1] || "image/jpeg";

      console.log("Calling Gemini API...");
      const result = await model.generateContent([
        prompt || "Identify this trading card.",
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        }
      ]);

      const text = result.response.text();
      console.log("Gemini API response received:", text);
      
      try {
        res.json(JSON.parse(text));
      } catch (e) {
        res.json({ text });
      }
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: error.message || "AI Analysis failed" });
    }
  });

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
