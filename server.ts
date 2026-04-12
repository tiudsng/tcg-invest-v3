import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

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
