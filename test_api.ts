import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

async function run() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    });
    console.log("Success:", response.text);
  } catch (error: any) {
    console.error("Failed:", JSON.stringify(error, null, 2));
    console.error("Message:", error.message);
  }
}

run();
