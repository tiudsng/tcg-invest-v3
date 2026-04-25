import { GoogleGenAI } from '@google/genai';

async function testKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("NO KEY");
    return;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hello world"
    });
    console.log("Success:", res.text);
  } catch (err: any) {
    console.error("Failed:", err.message);
  }
}

testKey();
