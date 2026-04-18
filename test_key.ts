import 'dotenv/config';
const key = process.env.GEMINI_API_KEY || '';
console.log(key ? `Length: ${key.length}, Starts: ${key.substring(0,4)}, Ends: ${key.substring(key.length-4)}` : "No key");
