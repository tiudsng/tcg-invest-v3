import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Clock, Calendar, User, Search, Grid, Heart, 
  MessageCircle, Send, Bookmark, MoreHorizontal, Sparkles, 
  CheckCircle2, Plus, Share2, HelpCircle 
} from 'lucide-react';
import { ARTICLES } from './articleData';
import { toast } from 'sonner';

export const Articles = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'feed' | 'insight'>('grid');
  
  // Interaction states stored in localStorage key = ID
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [commentsMap, setCommentsMap] = useState<Record<string, Array<{user: string, text: string, time: string}>>>({});
  const [newCommentTexts, setNewCommentTexts] = useState<Record<string, string>>({});
  const [isFollowing, setIsFollowing] = useState(false);

  // Initialize interactive state from localStorage
  useEffect(() => {
    try {
      const storedLikes = localStorage.getItem('ig_articles_likes');
      const storedBookmarks = localStorage.getItem('ig_articles_bookmarks');
      const storedComments = localStorage.getItem('ig_articles_comments');
      const storedFollowing = localStorage.getItem('ig_articles_following');

      if (storedLikes) setLikedMap(JSON.parse(storedLikes));
      if (storedBookmarks) setBookmarkedMap(JSON.parse(storedBookmarks));
      if (storedComments) setCommentsMap(JSON.parse(storedComments));
      if (storedFollowing) setIsFollowing(JSON.parse(storedFollowing) === true);
    } catch (e) {
      console.error("Localstorage init error", e);
    }
  }, []);

  const saveToLocal = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Localstorage save error", e);
    }
  };

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

  const handleLike = (articleId: string) => {
    const nextState = { ...likedMap, [articleId]: !likedMap[articleId] };
    setLikedMap(nextState);
    saveToLocal('ig_articles_likes', nextState);
    if (nextState[articleId]) {
      toast.success("已讚好貼文 💖");
    }
  };

  const handleBookmark = (articleId: string) => {
    const nextState = { ...bookmarkedMap, [articleId]: !bookmarkedMap[articleId] };
    setBookmarkedMap(nextState);
    saveToLocal('ig_articles_bookmarks', nextState);
    if (nextState[articleId]) {
      toast.success("已儲存貼文 📥");
    } else {
      toast.info("已取消儲存貼文");
    }
  };

  const handleFollow = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    saveToLocal('ig_articles_following', next);
    if (next) {
      toast.success("已追蹤 openclaw_tcg 🔔");
    } else {
      toast.info("已取消追蹤");
    }
  };

  const handleAddComment = (articleId: string) => {
    const text = newCommentTexts[articleId]?.trim();
    if (!text) return;

    const currentComments = commentsMap[articleId] || [];
    const newComment = {
      user: 'tcg_collector_99',
      text: text,
      time: '剛剛'
    };

    const nextState = {
      ...commentsMap,
      [articleId]: [...currentComments, newComment]
    };

    setCommentsMap(nextState);
    saveToLocal('ig_articles_comments', nextState);
    
    setNewCommentTexts({
      ...newCommentTexts,
      [articleId]: ''
    });
    toast.success("已發表留言 💬");
  };

  const handleShare = (article: any) => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt || article.title,
        url: window.location.origin + `/article/${article.id}`
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(window.location.origin + `/article/${article.id}`);
      toast.success("文章連結已複製到剪貼簿 🔗");
    }
  };

  const filteredArticles = articles.filter(a => 
    (a.title || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (a.excerpt || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#000] pt-20 pb-32 transition-colors duration-300 text-black dark:text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Top Mini Header */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-white/10 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-black dark:hover:text-white font-bold transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          
          <h2 className="text-xl font-black font-sans tracking-tight text-center flex items-center justify-center gap-1.5">
            <span>openclaw_tcg</span>
            <span className="inline-flex items-center justify-center w-4.5 h-4.5 bg-[#0095f6] text-white rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 fill-white text-[#0095f6]" />
            </span>
          </h2>
          
          <div className="w-10"></div> {/* Spacing spacer */}
        </div>

        {/* IG Profile Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-14 py-6 mb-10 border-b border-gray-200 dark:border-white/10">
          
          {/* Avatar with fancy story gradient ring */}
          <div className="relative group shrink-0">
            <div className="absolute inset-0 -m-1.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full animate-spin-slow duration-1000 p-0.5" />
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-white dark:border-[#000] bg-white">
              <img 
                src="https://images.unsplash.com/photo-1553531384-cc64ac80f931?auto=format&fit=crop&q=80&w=300"
                alt="OpenClaw Lobster Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Profile Bio Details */}
          <div className="flex-grow text-center md:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5 justify-center md:justify-start">
              <div className="flex items-center gap-1.5 justify-center">
                <h1 className="text-2xl font-light text-gray-900 dark:text-white font-sans">openclaw_tcg</h1>
                <span className="inline-flex">
                  <CheckCircle2 className="w-5 h-5 fill-[#0095f6] text-white" />
                </span>
              </div>
              
              <div className="flex gap-2 justify-center">
                <button 
                  onClick={() => toast.success("歡迎小龍蝦私訊合作！功能整合於 Telegram Bot")}
                  className="px-6 py-1.5 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg text-sm font-extrabold active:scale-95 transition-all shadow-sm"
                >
                  發送訊息
                </button>
              </div>
            </div>

            {/* Profile Statistics */}
            <div className="flex justify-center md:justify-start gap-10 mb-5 text-sm">
              <div>
                <span className="font-bold">{articles.length}</span> <span className="text-gray-500 dark:text-gray-400">貼文</span>
              </div>
              <div>
                <span className="font-bold">12.4k</span> <span className="text-gray-500 dark:text-gray-400">粉絲</span>
              </div>
              <div>
                <span className="font-bold">85</span> <span className="text-gray-500 dark:text-gray-400">追蹤中</span>
              </div>
            </div>

            {/* Biography */}
            <div className="text-sm space-y-1 font-medium text-gray-800 dark:text-gray-300 max-w-lg leading-relaxed">
              <p className="font-bold text-black dark:text-white">小龍蝦 OpenClaw 🦞 | TCG 投資大師</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">📊 產品 · 商業服務</p>
              <p>📈 專注卡牌市場走勢預警，即時分析 Snkrdunk 底層行情</p>
              <p>🤖 AI 智能監聽社群討論，一站式生成高價值市場情報</p>
              <p>📍 官方電報：<a href="https://t.me/tcg_invest_bot" target="_blank" rel="noopener noreferrer" className="text-[#00376b] dark:text-[#e0f1ff] font-bold hover:underline">@tcg_invest_bot</a></p>
            </div>
          </div>
        </div>

        {/* Sticky-Style IG Tab Navigation */}
        <div className="flex justify-center gap-14 border-t border-gray-200 dark:border-white/10 mb-8 max-w-md mx-auto">
          <button 
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-1.5 py-4 text-xs font-black tracking-widest uppercase border-t-2 transition-all ${
              activeTab === 'grid' 
                ? 'border-black dark:border-white text-black dark:text-white' 
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>貼文</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-1.5 py-4 text-xs font-black tracking-widest uppercase border-t-2 transition-all ${
              activeTab === 'feed' 
                ? 'border-black dark:border-white text-black dark:text-white' 
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>動態牆</span>
          </button>

          <button 
            onClick={() => setActiveTab('insight')}
            className={`flex items-center gap-1.5 py-4 text-xs font-black tracking-widest uppercase border-t-2 transition-all ${
              activeTab === 'insight' 
                ? 'border-black dark:border-white text-black dark:text-white' 
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>智能洞察</span>
          </button>
        </div>

        {/* Global Search inside IG profile */}
        <div className="relative max-w-md mx-auto mb-10">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input 
            type="text"
            placeholder="在 openclaw_tcg 搜尋關鍵字..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-100 dark:bg-white/5 border-0 rounded-xl text-sm text-gray-950 dark:text-white focus:ring-1 focus:ring-gray-400 dark:focus:ring-white transition-all font-medium"
          />
        </div>

        {/* Loader */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-[#0095f6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <HelpCircle className="w-16 h-16 mx-auto mb-4 opacity-40 text-gray-400" />
            <p className="text-lg font-bold">尚未發佈相關文章或搜尋無匹配</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* 1. GRID TAB LAYOUT */}
            {activeTab === 'grid' && (
              <motion.div 
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-3 gap-1 sm:gap-6"
              >
                {filteredArticles.map((article) => {
                  const commentsCount = commentsMap[article.id]?.length || 0;
                  const isLiked = likedMap[article.id] === true;
                  return (
                    <Link 
                      key={article.id} 
                      to={`/article/${article.id}`}
                      className="relative block aspect-square bg-gray-900 group overflow-hidden border border-gray-100 dark:border-neutral-900 rounded-sm sm:rounded-xl cursor-pointer"
                    >
                      <img 
                        src={article.imageUrl} 
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/600/600`;
                        }}
                      />
                      
                      {/* Grid hover overlays */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6 text-white text-sm sm:text-base font-black">
                        <div className="flex items-center gap-1.5">
                          <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'fill-white text-white'}`} />
                          <span>{isLiked ? 149 : 148}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-5 h-5 fill-white text-white" />
                          <span>{commentsCount}</span>
                        </div>
                      </div>

                      {/* Top ribbon if categorized */}
                      {article.category && (
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest scale-90 origin-top-left invisible sm:visible">
                          {article.category}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </motion.div>
            )}

            {/* 2. FEED TAB LAYOUT */}
            {activeTab === 'feed' && (
              <motion.div 
                key="feed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-10 max-w-lg mx-auto"
              >
                {filteredArticles.map((article) => {
                  const isLiked = likedMap[article.id] === true;
                  const isBookmarked = bookmarkedMap[article.id] === true;
                  const commentsList = commentsMap[article.id] || [];
                  const commentVal = newCommentTexts[article.id] || '';

                  return (
                    <div 
                      key={article.id}
                      className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm"
                    >
                      {/* Post Media Display */}
                      <div 
                        className="relative aspect-square cursor-pointer overflow-hidden bg-black"
                        onDoubleClick={() => handleLike(article.id)}
                      >
                        <img 
                          src={article.imageUrl} 
                          alt={article.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/800/800`;
                          }}
                        />
                        {/* Categories floating */}
                        <div className="absolute top-4 right-4 text-xs font-black bg-black/60 backdrop-blur-md text-white rounded-full px-3 py-1 scale-90">
                          {article.category || '投資動態'}
                        </div>
                      </div>

                      {/* Action Icon Row */}
                      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleLike(article.id)}
                            className="transition-transform duration-100 hover:scale-110 active:scale-90"
                          >
                            <Heart className={`w-7 h-7 ${isLiked ? 'fill-red-500 text-red-500 stroke-red-500' : 'text-gray-900 dark:text-white'}`} />
                          </button>
                          
                          <Link to={`/article/${article.id}`} className="hover:scale-110 active:scale-90 transition-transform">
                            <MessageCircle className="w-7 h-7 text-gray-900 dark:text-white" />
                          </Link>

                          <button 
                            onClick={() => handleShare(article)}
                            className="hover:scale-110 active:scale-90 transition-transform"
                          >
                            <Send className="w-7 h-7 text-gray-900 dark:text-white" />
                          </button>
                        </div>

                        <button 
                          onClick={() => handleBookmark(article.id)}
                          className="hover:scale-110 active:scale-90 transition-transform"
                        >
                          <Bookmark className={`w-7 h-7 ${isBookmarked ? 'fill-black dark:fill-white text-black dark:text-white' : 'text-gray-900 dark:text-white'}`} />
                        </button>
                      </div>

                      {/* Likes Block */}
                      <div className="px-3.5 pb-1 text-sm font-black text-gray-900 dark:text-white">
                        <span className="hover:underline cursor-pointer">{isLiked ? '149' : '148'} 個讚</span>
                      </div>

                      {/* Title & Caption Block */}
                      <div className="px-3.5 pb-2 text-sm leading-relaxed">
                        <span className="font-extrabold mr-2 text-gray-950 dark:text-white">openclaw_tcg</span>
                        <Link to={`/article/${article.id}`} className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
                          【{article.title}】
                        </Link>
                        <p className="mt-1 text-gray-600 dark:text-gray-300 font-medium">
                          {article.excerpt || article.content?.substring(0, 95).replace(/[#*`]/g, '') + '...'}
                        </p>
                      </div>

                      {/* Internal Comments List Display */}
                      {commentsList.length > 0 && (
                        <div className="px-3.5 py-1.5 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01] space-y-1">
                          {commentsList.map((c, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-extrabold mr-2 text-gray-900 dark:text-white">{c.user}</span>
                              <span className="text-gray-700 dark:text-gray-300">{c.text}</span>
                              <span className="text-[10px] text-gray-400 ml-2 font-bold">{c.time}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Call to Detail Link */}
                      <div className="px-3.5 pb-3">
                        <Link 
                          to={`/article/${article.id}`}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white font-black block"
                        >
                          點擊此處閱讀詳情及全文指南...
                        </Link>
                      </div>

                      {/* Time Marker */}
                      <div className="px-3.5 pb-3 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold">
                        {article.createdAt ? (
                          typeof article.createdAt.toDate === 'function'
                            ? new Date(article.createdAt.toDate()).toLocaleDateString()
                            : new Date(article.createdAt).toLocaleDateString()
                        ) : '2026/04/07'}
                      </div>

                      {/* Inline Instagram Add Comment Form */}
                      <div className="border-t border-gray-100 dark:border-white/5 flex items-center p-3 relative bg-white dark:bg-[#121212]">
                        <input 
                          type="text"
                          placeholder="發表留言..."
                          value={commentVal}
                          onChange={(e) => setNewCommentTexts({
                            ...newCommentTexts,
                            [article.id]: e.target.value
                          })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(article.id);
                          }}
                          className="w-full bg-transparent border-0 ring-0 focus:ring-0 text-sm placeholder-gray-400 dark:placeholder-gray-500 pr-14"
                        />
                        <button 
                          onClick={() => handleAddComment(article.id)}
                          disabled={!commentVal.trim()}
                          className="absolute right-4 text-sm font-black text-[#0095f6] hover:text-[#0056b3] disabled:opacity-30 disabled:pointer-events-none transition-all"
                        >
                          發佈
                        </button>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* 3. INSIGHT TAB LAYOUT */}
            {activeTab === 'insight' && (
              <motion.div 
                key="insight"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-xl mx-auto space-y-6"
              >
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute -right-10 -bottom-10 opacity-10 w-40 h-40 bg-white rounded-full"></div>
                  <h3 className="text-lg font-black flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                    小龍蝦 AI 智能投資簡報
                  </h3>
                  <p className="text-xs text-blue-100 font-medium leading-relaxed">
                    本系統利用領先的大語言模型即時解析市集買賣行與 Snkrdunk 即時價格走勢。每日自動同步，提供最具穿透力的行情報告。
                  </p>
                </div>

                <div className="space-y-4">
                  {filteredArticles.map((article, idx) => (
                    <div 
                      key={article.id}
                      className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 p-5 rounded-2xl flex gap-4 hover:shadow-md transition-shadow"
                    >
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 font-black">
                        #{idx + 1}
                      </div>
                      
                      <div className="space-y-1">
                        <Link to={`/article/${article.id}`} className="block">
                          <h4 className="font-extrabold text-sm text-gray-900 dark:text-white hover:text-[#0095f6] transition-colors leading-snug">
                            {article.title}
                          </h4>
                        </Link>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-bold flex items-center gap-2">
                          <span>{article.category || '市場情報'}</span>
                          <span>·</span>
                          <span>{article.readTime || '3 min'}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-300 leading-relaxed font-medium">
                          {article.excerpt || article.content?.substring(0, 80).replace(/[#*`]/g, '') + '...'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
