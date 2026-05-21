import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function testGemini() {
  console.log("--- Gemini API Diagnostic ---");
  const rawKey = process.env.GEMINI_API_KEY || "";
  const key = rawKey.trim();
  
  if (!key) {
    console.error("❌ GEMINI_API_KEY is missing or empty.");
    return;
  }
  
  console.log(`Key length: ${key.length}`);
  console.log(`Key start: ${key.substring(0, 5)}...`);
  console.log(`Key end: ...${key.substring(key.length - 5)}`);
  
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    console.log("✅ SDK Initialized.");
    
    console.log("Testing model generation...");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello, are you there? Reply with YES if you can hear me.",
    });
    
    console.log("Response text:", response.text);
    console.log("✅ API call successful!");
  } catch (error: any) {
    console.error("❌ API call failed:");
    console.error("Message:", error.message);
    if (error.status) console.error("Status:", error.status);
    if (error.details) console.error("Details:", JSON.stringify(error.details, null, 2));
  }
}

testGemini();
