// src/bot.ts
import { Telegraf } from 'telegraf';
import { db } from './firebase.ts'; // Import the db instance
import { collection, getDocs, query, limit, orderBy, deleteDoc, doc } from 'firebase/firestore';

// Warning: Do not hardcode the token!
// Use process.env.TELEGRAM_BOT_TOKEN
const rawToken = process.env.TELEGRAM_BOT_TOKEN;
const token = rawToken?.replace(/['"]/g, '').trim();

if (!token || !token.includes(':')) {
  console.warn("TELEGRAM_BOT_TOKEN is not set or invalid in environment variables. Bot commands disabled.");
}

const bot = token && token.includes(':') ? new Telegraf(token) : null;

// Export a function to start the bot safely
export async function startBot() {
  if (!bot) return;

  try {
    // Clear any existing webhook to prevent 409 Conflict if switching between instances/methods
    await bot.telegram.deleteWebhook();
    
    await bot.launch();
    console.log('Telegram bot (Telegraf) started successfully');
  } catch (err: any) {
    if (err.message?.includes('409: Conflict')) {
      console.warn('Telegram bot conflict (409) detected. Retrying in 5s...');
      setTimeout(startBot, 5000);
    } else {
      console.error('Failed to launch Telegram bot:', err.message);
    }
  }
}

if (bot) {
  bot.command('google', (ctx) => ctx.reply('Welcome! I am your TCG Invest Manager Bot. Use /setranks <ID1> <ID2>... to set order, /updateleaderboard to sync, /listArticles to see info, and /deleteArticle <id> to remove them.'));

  bot.command('listArticles', async (ctx) => {
    try {
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);
      
      let message = 'Current Articles:\n';
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        message += `- [${doc.id}] ${data.title}\n`;
      });
      
      ctx.reply(message || 'No articles found.');
    } catch (error) {
      console.error('Error listing articles:', error);
      ctx.reply('Failed to fetch articles.');
    }
  });

  bot.command('deleteArticle', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      ctx.reply('Usage: /deleteArticle <articleId>');
      return;
    }
    
    const articleId = args[1];
    try {
      await deleteDoc(doc(db, 'articles', articleId));
      ctx.reply(`Article ${articleId} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting article:', error);
      ctx.reply('Failed to delete article.');
    }
  });

  bot.command('updateleaderboard', async (ctx) => {
    try {
      const { syncLeaderboard } = await import('./lib/leaderboardService.ts');
      const rawEnv = process.env.GEMINI_API_KEY || "";
      const currentKey = rawEnv.match(/AIzaSy[A-Za-z0-9_-]+/)?.[0] || rawEnv.trim();

      ctx.reply('🚀 正在啟動排行榜同步引擎 (Regex + AI)，請稍候...');
      
      // Correct arguments: onProgress, dbOverride, apiKeyOverride
      await syncLeaderboard(undefined, db, currentKey);
      
      ctx.reply('✅ 排行榜數據同步完成！日文版大圖與 AI 市場分析已更新。');
    } catch (error: any) {
      console.error('Bot Sync Error:', error);
      ctx.reply(`❌ 同步失敗: ${error.message}`);
    }
  });

  bot.command('setranks', async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('❌ 請輸入卡片 Snkrdunk ID 或 Card Number。用法：/setranks id1 id2 id3...');
        return;
      }

      const rankings = args.slice(0, 10); // Remove the startsWith('snkrdunk_') restriction
      
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'config', 'leaderboard'), { 
        rankings,
        updatedAt: new Date().toISOString(),
        updatedBy: 'bot'
      });
      
      ctx.reply(`✅ 成功設定排行榜順序！請輸入 /updateleaderboard 開始同步新的數據。\n新名單：\n${rankings.map((id, i) => `${i+1}. ${id}`).join('\n')}`);
    } catch (error: any) {
      console.error('Set Ranks Error:', error);
      ctx.reply(`❌ 設定失敗 (Client Mode): ${error.message}`);
    }
  });

  // Handle free text for AI analysis (OpenClaw logic)
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return; // Ignore other commands

    if (text.toLowerCase().includes("openclaw") || text.includes("小龍蝦")) {
      const rawEnv = process.env.GEMINI_API_KEY || "";
      const currentKey = rawEnv.trim();
      
      if (!currentKey) {
        console.error(`[Bot] Invalid Gemini Key detected: Key is empty`);
        ctx.reply('⚠️ AI 功能暫時未配置，請檢查伺服器環境設定。🦞');
        return;
      }

      ctx.sendChatAction('typing');
      
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const prompt = `
          User input: "${text}"
          You are "OpenClaw (小龍蝦)" and "Hermès agent", a market analyst for Pokemon TCG.
          Based on the user's intent, decide what to do.
          Return a JSON object:
          {
            "action": "post_article" | "update_price" | "reply",
            "title": "Title (if post)",
            "content": "Full markdown (if post)",
            "category": "情報分析",
            "zone": 1 | 2 | 3 | 0,
            "card_id": "snkrdunk_146897 (if update_price, extract or infer the ID with snkrdunk_ prefix)",
            "psa10_price": 5000 (if updating PSA10 price),
            "raw_price": 2000 (if updating RAW price),
            "reply": "Message back to telegram"
          }
          ONLY return the JSON (no markdown blocks).
        `;

        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: prompt
        });
        const responseText = (response.text || "").trim();
        let actionData;
        try {
          actionData = JSON.parse(responseText.replace(/```json|```/g, ''));
        } catch (e) {
          actionData = { action: "reply", reply: responseText };
        }

        if (actionData.action === "post_article") {
          console.log('OpenClaw: Posting article...', actionData.title);
          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
          const article = {
            title: actionData.title,
            content: actionData.content,
            category: actionData.category || "情報分析",
            zone: actionData.zone || 0,
            author: "HERMÈS 數據分析",
            imageUrl: `https://picsum.photos/seed/${encodeURIComponent(actionData.title)}/1200/800`,
            readTime: `${Math.ceil(actionData.content.length / 500)} min read`,
            createdAt: serverTimestamp(),
            featured: (actionData.zone || 0) > 0,
            postedBy: 'bot'
          };
          await addDoc(collection(db, "articles"), article);
          console.log('OpenClaw: Article posted successfully');
        } else if (actionData.action === "update_price" && actionData.card_id) {
           console.log('Hermès: Updating price for', actionData.card_id);
           const { updateProductPrice } = await import('./lib/priceService');
           
           await updateProductPrice(actionData.card_id, {
             psa10_price: actionData.psa10_price,
             raw_price: actionData.raw_price,
             source: 'bot'
           });
        }

        ctx.reply(actionData.reply || "發佈成功！🦞");
      } catch (aiError: any) {
        console.error("Gemini AI Error:", aiError.message);
        ctx.reply(`AI 處理出錯: ${aiError.message}`);
      }
    }
  });

  // Enable graceful stop
  process.once('SIGINT', () => bot?.stop('SIGINT'));
  process.once('SIGTERM', () => bot?.stop('SIGTERM'));
}

export default bot;
