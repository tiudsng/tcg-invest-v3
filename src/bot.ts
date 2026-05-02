// src/bot.ts
import { Telegraf } from 'telegraf';
import { db } from './firebase.ts';
import { collection, getDocs, query, limit, orderBy, deleteDoc, doc, setDoc, getDoc, updateDoc, arrayUnion, addDoc, serverTimestamp } from 'firebase/firestore';
import { syncLeaderboard, syncSingleCard } from './lib/leaderboardService.js';
import { scrapeSnkrdunkMarketStats, scrapePSAPopulation, scrapePokecaChartAdvancedData } from './lib/snkrdunkSearchService.js';
import { updateProductPrice } from './lib/priceService.js';
import { GoogleGenAI } from '@google/genai';

// Warning: Do not hardcode the token!
// Use process.env.TELEGRAM_BOT_TOKEN
const rawToken = process.env.TELEGRAM_BOT_TOKEN;
const token = rawToken?.replace(/['"]/g, '').trim();

if (!token || !token.includes(':')) {
  console.warn("TELEGRAM_BOT_TOKEN is not set or invalid in environment variables. Bot commands disabled.");
}

const bot = token && token.includes(':') ? new Telegraf(token) : null;

// Export a function to send a notification to the admin
export async function sendAdminNotification(message: string) {
  if (!bot || !token) {
    console.warn("[Bot] Cannot send notification: Bot or Token missing");
    return;
  }
  
  const adminId = (process.env.ADMIN_CHAT_ID || "").replace(/['"]/g, '').trim();
  console.log(`[Bot] Attempting to notify admin. ID present: ${!!adminId}. Token valid: ${token.substring(0, 5)}...`);
  
  if (adminId) {
    try {
      const maskedId = adminId.length > 5 ? `${adminId.substring(0, 3)}...${adminId.substring(adminId.length - 2)}` : adminId;
      console.log(`[Bot] Sending message to: ${maskedId}`);
      await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      console.log('[Bot] Notification sent to admin successfully');
    } catch (err: any) {
      if (err.message?.includes('403: Forbidden: bots can\'t send messages to bots')) {
        console.error('[Bot] CRITICAL: ADMIN_CHAT_ID is set to a bot ID. Bots cannot message other bots.');
      } else {
        console.error('[Bot] Failed to send admin notification:', err.message);
      }
    }
  } else {
    console.log('[Bot] No ADMIN_CHAT_ID set. Logging notification content:');
    console.log('--- NOTIFICATION START ---');
    console.log(message);
    console.log('--- NOTIFICATION END ---');
  }
}

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

  // Helper to resolve card ID from various inputs (Snkrdunk ID, Card Number, Name)
  async function resolveCardId(input: string, ctx: any): Promise<string | null> {
    const term = input.trim();
    if (!term) return null;

    // 1. Direct Snkrdunk ID
    if (term.startsWith('snkrdunk_')) return term;
    if (/^\d{5,}$/.test(term)) return `snkrdunk_${term}`;

    // 2. Search in products collection
    ctx.reply(`🔍 正在辨識卡片 '${term}'...`);
    try {
      const allSnap = await getDocs(query(collection(db, 'products'), limit(5000)));
      const searchTerms = term.toLowerCase().split(/\s+/).filter(Boolean);
      
      const filtered = allSnap.docs.filter(doc => {
        const data = doc.data();
        const combined = [
          data.name, 
          data.name_zh, 
          data.name_jp, 
          data.card_number, 
          data.set_name, 
          data.set_code,
          data.display
        ].filter(Boolean).join(' ').toLowerCase();
        return searchTerms.every(t => combined.includes(t));
      });

      if (filtered.length > 0) {
        // Priority matching logic
        let targetDoc = filtered[0];
        const exactSearchTerm = term.toLowerCase();
        
        // Try strict card number match
        const exactCardNumMatch = filtered.find(d => {
          const cn = (d.data().card_number || '').toLowerCase();
          return cn === exactSearchTerm || cn.split('/')[0] === exactSearchTerm || cn.split('-')[0] === exactSearchTerm;
        });

        if (exactCardNumMatch) {
          targetDoc = exactCardNumMatch;
        } else {
          // Try set_code + card_number combined match (e.g. SV4a 347)
          const setCodeMatch = filtered.find(d => {
             const sc = (d.data().set_code || '').toLowerCase();
             const cn = (d.data().card_number || '').toLowerCase();
             return searchTerms.some(t => sc.includes(t)) && searchTerms.some(t => cn.includes(t));
          });
          if (setCodeMatch) targetDoc = setCodeMatch;
        }
        
        const data = targetDoc.data();
        ctx.reply(`✅ 辨識成功：${data.name_zh || data.name} (${data.card_number || 'N/A'}) [${targetDoc.id}]`);
        return targetDoc.id;
      }
    } catch (err) {
      console.error('Resolve Card ID Error:', err);
    }

    ctx.reply(`❌ 無法辨識 '${term}'。請嘗試輸入正確卡號 (如 SV4a 347/190) 或 Snkrdunk ID。`);
    return null;
  }

  bot.command(['updateleaderboard', 'updateleader'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      const rawEnv = process.env.GEMINI_API_KEY || "";
      const currentKey = rawEnv.replace(/['"]/g, '').trim();

      if (args.length >= 2) {
        let rankStr = args[0].toLowerCase();
        let cardIdArg = args.slice(1).join(' ');
        
        const cardId = await resolveCardId(cardIdArg, ctx);
        if (!cardId) return;
        
        let targetIndex = -1;
        if (rankStr.startsWith('rank_')) {
          const num = parseInt(rankStr.split('_')[1]);
          if (!isNaN(num) && num >= 1) {
            targetIndex = num - 1;
            rankStr = `rank_${num.toString().padStart(2, '0')}`;
          }
        } else if (!isNaN(parseInt(rankStr))) {
          const num = parseInt(rankStr);
          if (num >= 1) {
            targetIndex = num - 1;
            rankStr = `rank_${num.toString().padStart(2, '0')}`;
          }
        }
        
        if (targetIndex >= 0) {
          ctx.reply(`⏳ 正在更新 ${rankStr} 為 ${cardId}...`);
          
          const docRef = doc(db, 'config', 'leaderboard');
          const docSnap = await getDoc(docRef);
          let currentRankings = docSnap.exists() ? (docSnap.data().rankings || []) : [];
          
          while (currentRankings.length <= targetIndex) {
            currentRankings.push('');
          }
          currentRankings[targetIndex] = cardId;
          
          await setDoc(docRef, { 
            rankings: currentRankings,
            updatedAt: new Date().toISOString(),
            updatedBy: 'bot'
          }, { merge: true });
          
          try {
            await syncSingleCard(rankStr, cardId, db, currentKey);
            ctx.reply(`✅ 成功更新 ${rankStr} 為 ${cardId} 並完成同步！`);
          } catch(e: any) {
            ctx.reply(`✅ 已更新排序設定，但單卡同步失敗: ${e.message}`);
          }
          return;
        }
      }

      ctx.reply('🚀 正在啟動排行榜同步引擎 (Regex + AI)，請稍候...');
      await syncLeaderboard((msg) => console.log(msg), db, currentKey);
      ctx.reply('✅ 排行榜數據同步完成！日文版大圖與 AI 市場分析已更新。');
    } catch (error: any) {
      console.error('Bot Sync Error:', error);
      ctx.reply(`❌ 同步失敗: ${error.message}`);
    }
  });

  bot.command(['setranks'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('❌ 請輸入卡片 Snkrdunk ID。用法：/setranks id1 id2 id3... (注意：此指令會覆蓋整個排行榜，若只需新增請用 /addrank id)');
        return;
      }

      const validArgs = args.filter(a => a.startsWith('snkrdunk_') || /^\d+$/.test(a)).map(a => a.startsWith('snkrdunk_') ? a : `snkrdunk_${a}`);
      if (validArgs.length === 0) {
        ctx.reply('❌ 請輸入有效的 Snkrdunk ID。');
        return;
      }
      const rankings = validArgs.slice(0, 10); // Extract up to 10 valid IDs
      
      await setDoc(doc(db, 'config', 'leaderboard'), { 
        rankings,
        updatedAt: new Date().toISOString(),
        updatedBy: 'bot'
      }, { merge: true });
      
      ctx.reply(`✅ 成功設定排行榜順序！請輸入 /updateleaderboard 開始同步新的數據。\n新名單：\n${rankings.map((id, i) => `${i+1}. ${id}`).join('\n')}`);
    } catch (error: any) {
      console.error('Set Ranks Error:', error);
      ctx.reply(`❌ 設定失敗 (Client Mode): ${error.message}`);
    }
  });

  bot.command(['switch'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length < 2) {
        ctx.reply('❌ 用法：/switch <位次1> <位次2> (例如: /switch 1 2)');
        return;
      }
      
      const rank1Num = parseInt(args[0]);
      const rank2Num = parseInt(args[1]);
      
      if (isNaN(rank1Num) || isNaN(rank2Num) || rank1Num < 1 || rank2Num < 1) {
        ctx.reply('❌ 請輸入有效的位次數字。');
        return;
      }
      
      const rank1Id = `rank_${rank1Num.toString().padStart(2, '0')}`;
      const rank2Id = `rank_${rank2Num.toString().padStart(2, '0')}`;
      
      ctx.reply(`⏳ 正在交換 NO.${rank1Num} 與 NO.${rank2Num}...`);
      
      const doc1Ref = doc(db, 'leaderboard', rank1Id);
      const doc2Ref = doc(db, 'leaderboard', rank2Id);
      
      const [snap1, snap2] = await Promise.all([getDoc(doc1Ref), getDoc(doc2Ref)]);
      
      if (!snap1.exists() || !snap2.exists()) {
        ctx.reply('❌ 其中一個位次在排行榜中不存在數據。');
        return;
      }
      
      const data1 = snap1.data();
      const data2 = snap2.data();
      
      // Perform direct swap of all document data
      // We explicitly override the 'rank' field to match its new document ID
      await Promise.all([
        setDoc(doc1Ref, { ...data2, rank: rank1Num }),
        setDoc(doc2Ref, { ...data1, rank: rank2Num })
      ]);
      
      ctx.reply(`✅ 成功交換 NO.${rank1Num} (${data1.name_zh || '卡片A'}) 與 NO.${rank2Num} (${data2.name_zh || '卡片B'})！`);
    } catch (e: any) {
      console.error('Switch Command Error:', e);
      ctx.reply(`❌ 交換失敗: ${e.message}`);
    }
  });

  bot.command(['addrank', 'setrank'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('❌ 請輸入要新增的卡片 Snkrdunk ID。用法：/addrank id (或等多個 id 排列)');
        return;
      }

      const validArgs = args.filter(a => a.startsWith('snkrdunk_') || /^\d+$/.test(a)).map(a => a.startsWith('snkrdunk_') ? a : `snkrdunk_${a}`);
      if (validArgs.length === 0) {
        ctx.reply('❌ 請輸入有效的 Snkrdunk ID。');
        return;
      }
      
      const docRef = doc(db, 'config', 'leaderboard');
      
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();
      let currentRankings = data?.rankings || [];
      
      // Filter out those already in the rankings
      const toAdd = validArgs.filter(a => !currentRankings.includes(a));
      
      if (toAdd.length === 0) {
        ctx.reply('⚠️ 這些卡片已經在排行榜中了！');
        return;
      }

      await updateDoc(docRef, { 
        rankings: arrayUnion(...toAdd),
        updatedAt: new Date().toISOString(),
        updatedBy: 'bot'
      });
      
      ctx.reply(`✅ 成功新增卡片到排行榜末端！請輸入 /updateleaderboard 開始同步新的數據。\n新增名單：\n${toAdd.join('\n')}`);
    } catch (error: any) {
      console.error('Add Rank Error:', error);
      ctx.reply(`❌ 設定失敗: ${error.message}`);
    }
  });

  bot.command(['syncpokeca'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('💡 指令優化：現在支援輸入卡號識別！\n用法：/syncpokeca <卡號/名稱/ID>\n範例1：/syncpokeca SV4a 347/190\n範例2：/syncpokeca 164250');
        return;
      }
      const cardId = await resolveCardId(args.join(' '), ctx);
      if (!cardId) return;

      ctx.reply(`⏳ 正在深度同步卡片數據與進階走勢圖... [${cardId}]`);
      const result = await syncSingleCard('search_result', cardId, db, process.env.GEMINI_API_KEY);
      
      const m = result.market_data || {};
      const chart = result.pokeca_chart_data?.stats?.psa10 || {};
      
      let msg = `✅ **同步完成：${result.name_zh || result.name || cardId}**\n\n`;
      msg += `📊 **市場數據 (HKD)**\n`;
      msg += ` PSA 10 售價: HK$ ${(m.psa10_price || 0).toLocaleString()}\n`;
      msg += ` RAW 裸卡售價: HK$ ${(m.raw_price || 0).toLocaleString()}\n\n`;
      
      msg += `💎 **PSA 鑑定人口**\n`;
      msg += ` PSA 10 數量: ${m.psa_pop_10 || m.psa10_population || '-'}\n`;
      msg += ` 總鑑定量: ${m.psa_pop_total || '-'}\n`;
      msg += ` PSA 10 比例: ${m.psa_pop_10_percent || '-'}\n\n`;
      
      if (chart.latest_price) {
        msg += `📈 **進階走勢 (日幣)**\n`;
        msg += ` 最新價: ${chart.latest_price}\n`;
        msg += ` 7日漲跌: ${chart.change_7d || '-'}\n`;
      }
      
      msg += `\n✨ 所有詳細歷史走勢與人口分布已同步至資料庫。`;
      
      ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch(err: any) {
      ctx.reply(`❌ 同步失敗: ${err.message}`);
    }
  });

  bot.command(['updateprice'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('❌ 用法：/updateprice <卡號/名稱/ID>');
        return;
      }
      
      const cardId = await resolveCardId(args.join(' '), ctx);
      if (!cardId) return;

      ctx.reply(`⏳ 正在抓取 ${cardId} 的最新價格與 PSA 人口...`);
      
      const stats = await scrapeSnkrdunkMarketStats(cardId);
      const rateMap: Record<string, number> = { "US $": 150, "SG $": 110, "¥": 1 };
      const cur = stats.currency.trim();
      const conversionRate = rateMap[cur] || 150;
      const JPY_TO_HKD = 0.052;
      
      let psa10_jpy = stats.median_sold_psa10 ? Math.round(stats.median_sold_psa10 * conversionRate) : null;
      let raw_jpy = stats.median_sold_raw ? Math.round(stats.median_sold_raw * conversionRate) : null;
      
      let msg = `✅ **價格抓取成功！** [${cardId}]\n`;
      msg += `抓取方法: ${stats.method}\n`;
      msg += `解析貨幣: ${cur} (預估匯率 ${conversionRate})\n\n`;
      
      const record: any = { source: 'scraper' };
      
      // Attempt to get PSA 10 population
      const docSnap = await getDocs(query(collection(db, 'products')));
      const targetDoc = docSnap.docs.find(d => d.id === cardId);
      if (targetDoc) {
        const data = targetDoc.data();
        if (data.set_code && data.card_number) {
          const setId = `${data.set_code}-${data.card_number}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
          try {
            const pop = await scrapePSAPopulation(setId);
            if (pop !== null) {
              record.psa10_population = pop;
              msg += `💎 **PSA 10** 人口: ${pop} 張\n\n`;
            } else {
              msg += `💎 **PSA 10** 人口: 無資料查無此卡號\n\n`;
            }
          } catch(e) {}
        }
      }

      if (psa10_jpy) {
         const hkd = Math.round(psa10_jpy * JPY_TO_HKD);
         record.psa10_price = hkd;
         msg += `🔹 **PSA 10** 中位數: ${stats.median_sold_psa10} ${cur} (約 ¥${psa10_jpy} / HK$${hkd})\n`;
      } else {
         msg += `🔹 **PSA 10** 中位數: 無資料\n`;
      }
      
      if (raw_jpy) {
         const hkd = Math.round(raw_jpy * JPY_TO_HKD);
         record.raw_price = hkd;
         msg += `🔸 **RAW (未鑑定)** 中位數: ${stats.median_sold_raw} ${cur} (約 ¥${raw_jpy} / HK$${hkd})\n`;
      } else {
         msg += `🔸 **RAW (未鑑定)** 中位數: 無資料\n`;
      }
      
      await updateProductPrice(cardId, record, db);
      
      ctx.reply(msg, { parse_mode: 'Markdown' });
      
    } catch (e: any) {
      console.error('Update Price Error:', e);
      ctx.reply(`❌ 更新價格失敗: ${e.message}`);
    }
  });

  bot.command(['updatepsapopall'], async (ctx) => {
    try {
      ctx.reply('🚀 開始啟動全面 PSA 人口數據更新排程... 這將需要一段時間 (可能會遭遇防爬限制)。');
      
      const allSnap = await getDocs(collection(db, 'products'));
      const docs = allSnap.docs.filter(d => d.id.startsWith('snkrdunk_'));
      const total = docs.length;
      
      ctx.reply(`📦 共獲取到 ${total} 張有效商品卡片，開始背景更新...`);
      
      (async () => {
        let successCount = 0;
        let errorCount = 0;
        let noDataCount = 0;
        
        for (let i = 0; i < total; i++) {
          const doc = docs[i];
          const data = doc.data();
          const cardId = doc.id;
          
          if (data.set_code && data.card_number) {
            const setId = `${data.set_code}-${data.card_number}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            try {
              const pop = await scrapePSAPopulation(setId);
              if (pop !== null) {
                await updateProductPrice(cardId, { 
                  source: 'scraper', 
                  psa10_population: pop.psa10,
                  psa_pop_total: pop.total
                }, db);
                successCount++;
              } else {
                noDataCount++;
              }
            } catch (e: any) {
              console.error(`Failed to update PSA pop for ${cardId}:`, e.message);
              errorCount++;
            }
          } else {
             noDataCount++;
          }
          
          if ((i + 1) % 100 === 0) {
            try {
              await ctx.reply(`⏳ PSA 數據進度報告: 已處理 ${i + 1} / ${total} 張卡片\n✅ 成功: ${successCount}\n⚠️ 無數據/跳過: ${noDataCount}\n❌ 失敗: ${errorCount}`);
            } catch (err) {}
          }
          
          // Random delay
          await new Promise(res => setTimeout(res, 2000 + Math.random() * 2000));
        }
        
        try {
          await ctx.reply(`🎉 全面 PSA 人口數據更新排程結束！\n總計: ${total}\n✅ 成功: ${successCount}\n⚠️ 無數據/跳過: ${noDataCount}\n❌ 失敗: ${errorCount}`);
        } catch (err) {}
      })();
      
    } catch (e: any) {
      console.error('Update PSA Pop All Error:', e);
      ctx.reply(`❌ 啟動失敗: ${e.message}`);
    }
  });

  bot.command(['updatepriceall'], async (ctx) => {
    try {
      ctx.reply('🚀 開始啟動全面價格與PSA更新排程... 這將需要一段時間 (可能會遭遇防爬限制)。');
      
      const allSnap = await getDocs(collection(db, 'products'));
      const docs = allSnap.docs.filter(d => d.id.startsWith('snkrdunk_'));
      const total = docs.length;
      
      ctx.reply(`📦 共獲取到 ${total} 張有效商品卡片，開始背景更新...`);
      
      // Execute in background so we don't hold the connection
      (async () => {
        let successCount = 0;
        let errorCount = 0;
        let noDataCount = 0;
        
        for (let i = 0; i < total; i++) {
          const doc = docs[i];
          const cardId = doc.id;
          const data = doc.data();
          
          try {
            const stats = await scrapeSnkrdunkMarketStats(cardId);
            const rateMap: Record<string, number> = { "US $": 150, "SG $": 110, "¥": 1 };
            const cur = stats.currency.trim();
            const conversionRate = rateMap[cur] || 150;
            const JPY_TO_HKD = 0.052;
            
            let psa10_jpy = stats.median_sold_psa10 ? Math.round(stats.median_sold_psa10 * conversionRate) : null;
            let raw_jpy = stats.median_sold_raw ? Math.round(stats.median_sold_raw * conversionRate) : null;
            
            const record: any = { source: 'scraper' };
            
            if (psa10_jpy) {
               record.psa10_price = Math.round(psa10_jpy * JPY_TO_HKD);
            }
            if (raw_jpy) {
               record.raw_price = Math.round(raw_jpy * JPY_TO_HKD);
            }
            
            if (data.set_code && data.card_number) {
              const setId = `${data.set_code}-${data.card_number}`.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
              try {
                const pop = await scrapePSAPopulation(setId);
                if (pop !== null) {
                  record.psa10_population = pop;
                }
              } catch (e: any) {}
            }
            
            if (record.psa10_price || record.raw_price || record.psa10_population) {
              await updateProductPrice(cardId, record, db);
              successCount++;
            } else {
              noDataCount++;
            }
          } catch (e: any) {
            console.error(`Failed to update ${cardId}:`, e.message);
            errorCount++;
          }
          
          if ((i + 1) % 100 === 0) {
            try {
              await ctx.reply(`⏳ 進度報告: 已處理 ${i + 1} / ${total} 張卡片\n✅ 成功: ${successCount}\n⚠️ 無價格: ${noDataCount}\n❌ 失敗: ${errorCount}`);
            } catch (err) {}
          }
          
          // Random delay to avoid hitting rate limits too fast (3 - 5 sec)
          await new Promise(res => setTimeout(res, 3000 + Math.random() * 2000));
        }
        
        try {
          await ctx.reply(`🎉 全面價格更新排程結束！\n總計: ${total}\n✅ 成功: ${successCount}\n⚠️ 無價格: ${noDataCount}\n❌ 失敗: ${errorCount}`);
        } catch (err) {}
      })();
      
    } catch (e: any) {
      console.error('Update Price All Error:', e);
      ctx.reply(`❌ 啟動失敗: ${e.message}`);
    }
  });

  bot.command(['psapop'], async (ctx) => {
    try {
      const args = ctx.message.text.split(/\s+/).slice(1);
      if (args.length === 0) {
        ctx.reply('❌ 用法：/psapop <卡片編號> (例如: /psapop s6a-095-069 或 /psapop S6a 095/069)');
        return;
      }
      const setId = args.join(' ');
      ctx.reply(`⏳ 正在前往 grading.pokeca-chart.com 抓取 ${setId} 的 PSA 10 人口數據... (需要開啟無頭瀏覽器，請稍候)`);
      
      const pop = await scrapePSAPopulation(setId);
      
      if (pop !== null) {
        ctx.reply(`✅ **${setId}** 的 PSA 10 人口數量為: **${pop}** 張`, { parse_mode: 'Markdown' });
      } else {
        ctx.reply(`⚠️ 無法找到 **${setId}** 的在線數據，請確認卡號格式是否正確或是該網站有無記錄。`);
      }
    } catch (e: any) {
      console.error('PSA Pop Error:', e);
      ctx.reply(`❌ 查詢失敗: ${e.message}`);
    }
  });


  // Handle free text for AI analysis (OpenClaw logic)
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return; // Ignore other commands

    if (text.toLowerCase().includes("openclaw") || text.includes("小龍蝦")) {
      const rawEnv = process.env.GEMINI_API_KEY || "";
      const currentKey = rawEnv.toString().replace(/['"]/g, '').trim();
      
      if (!currentKey) {
        console.error(`[Bot] Invalid Gemini Key detected: Key is empty`);
        ctx.reply('⚠️ AI 功能暫時未配置，請檢查伺服器環境設定。🦞');
        return;
      }

      ctx.sendChatAction('typing');
      
      try {
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
          model: "gemini-3-flash-preview",
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
