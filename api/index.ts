import express from "express";
import cors from "cors";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

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

export default app;
