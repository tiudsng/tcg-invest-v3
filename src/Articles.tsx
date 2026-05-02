import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Clock, BookOpen, Calendar, User, Search } from 'lucide-react';
import { ARTICLES } from './articleData';

export const Articles = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        let dbArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
        // Exclude specific unwanted articles using keyword matching
        const unwantedKeywords = [
          "升幅",
          "市場升溫",
          "熱抄",
          "噴火龍"
        ];
        
        dbArticles = dbArticles.filter(article => {
          const title = article.title || "";
          return !unwantedKeywords.some(keyword => title.includes(keyword));
        });

        // Merge static articles with DB articles
        const merged = [...dbArticles];
        ARTICLES.forEach(staticArt => {
          if (!merged.find(a => a.id === staticArt.id)) {
            merged.push(staticArt);
          }
        });

        // Sort by date
        merged.sort((a: any, b: any) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date());
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt ? new Date(b.createdAt) : new Date());
          return dateB.getTime() - dateA.getTime();
        });

        setArticles(merged);
      } catch (error) {
        console.error("Error fetching articles:", error);
        setArticles(ARTICLES);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const filteredArticles = articles.filter(a => 
    (a.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (a.excerpt || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] pt-24 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors mb-4 font-bold"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </button>
            <h1 className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-4">
              <BookOpen className="w-10 h-10 text-blue-600" />
              收藏家指南
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 font-medium">
              探索 TCG 世界的最新動態、投資分析與收藏技巧。
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="搜尋文章標題或內容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 dark:bg-white/5 rounded-[2.5rem] h-96 animate-pulse" />
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-32">
            <Search className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">找不到相關文章</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12">
            {filteredArticles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white dark:bg-[#111] rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col h-full"
              >
                <Link to={`/article/${article.id}`} className="block relative aspect-[16/10] overflow-hidden">
                  <img 
                    src={article.imageUrl} 
                    alt={article.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/800/500?blur=2`;
                    }}
                  />
                  {article.category && (
                    <div className="absolute top-4 left-4 px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg">
                      {article.category}
                    </div>
                  )}
                </Link>
                <div className="p-8 flex flex-col flex-grow">
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4 font-bold">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {article.createdAt ? (
                        typeof article.createdAt.toDate === 'function'
                          ? new Date(article.createdAt.toDate()).toLocaleDateString()
                          : new Date(article.createdAt).toLocaleDateString()
                      ) : '2026/04/07'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {article.readTime || '5 min'}
                    </div>
                  </div>
                  <Link to={`/article/${article.id}`}>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4 line-clamp-2 group-hover:text-blue-600 transition-colors leading-tight">
                      {article.title}
                    </h3>
                  </Link>
                  <p className="text-gray-500 dark:text-gray-400 line-clamp-3 mb-8 text-base font-medium leading-relaxed">
                    {article.excerpt || article.content?.substring(0, 120).replace(/[#*`]/g, '') + '...'}
                  </p>
                  <div className="mt-auto pt-6 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{article.author || '小龍蝦'}</span>
                    </div>
                    <Link 
                      to={`/article/${article.id}`}
                      className="text-blue-600 dark:text-blue-400 font-black text-sm hover:underline"
                    >
                      閱讀更多
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
