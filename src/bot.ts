// src/bot.ts
import { Telegraf } from 'telegraf';
import { db } from './firebase'; // Import the db instance
import { collection, getDocs, deleteDoc, doc, query, limit, orderBy } from 'firebase/firestore';

// Warning: Do not hardcode the token!
// Use process.env.TELEGRAM_BOT_TOKEN
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is not set in environment variables!");
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Welcome! I am your TCG Invest Manager Bot. Use /listArticles to see articles and /deleteArticle <id> to remove them.'));

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

// Launch bot
bot.launch().then(() => console.log('Telegram bot started'));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
