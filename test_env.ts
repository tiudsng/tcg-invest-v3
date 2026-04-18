import 'dotenv/config';
console.log('Key present:', !!process.env.GEMINI_API_KEY);
console.log('Length:', process.env.GEMINI_API_KEY?.length);
console.log('Start:', process.env.GEMINI_API_KEY?.substring(0, 4));
