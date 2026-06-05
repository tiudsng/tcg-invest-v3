import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ArrowLeft, Heart, MessageCircle, Send, Bookmark, CheckCircle2, Share2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ARTICLES } from './articleData';
import { toast } from 'sonner';

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  category?: string;
  readTime?: string;
  imageUrl: string;
  author?: string;
  createdAt?: any;
}

export const ArticleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Array<{user: string, text: string, time: string}>>([]);

  // Load interaction states from localStorage
  useEffect(() => {
    if (!id) return;
    try {
      const storedLikes = localStorage.getItem('ig_articles_likes');
      const storedBookmarks = localStorage.getItem('ig_articles_bookmarks');
      const storedComments = localStorage.getItem('ig_articles_comments');
      
      if (storedLikes) {
        const likesMap = JSON.parse(storedLikes);
        if (likesMap[id]) setLiked(true);
      }
      if (storedBookmarks) {
        const bookmarksMap = JSON.parse(storedBookmarks);
        if (bookmarksMap[id]) setBookmarked(true);
      }
      if (storedComments) {
        const commentsMap = JSON.parse(storedComments);
        if (commentsMap[id]) setComments(commentsMap[id]);
      }
    } catch (e) {
      console.error("LocalStorage init error", e);
    }
  }, [id]);

  const saveInteraction = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("LocalStorage save error", e);
    }
  };

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      // First check static data
      const staticArticle = ARTICLES.find(a => a.id === id);
      if (staticArticle) {
        setArticle({
          ...staticArticle,
          content: (staticArticle as any).content || `# ${staticArticle.title}\n\n這是一篇關於 ${staticArticle.title} 的詳細文章內容。目前正由 OPENCLAW 小龍蝦撰寫中...\n\n![Image](${staticArticle.imageUrl})`
        } as Article);
        setLoading(false);
        return;
      }

      // Then check Firestore
      try {
        const docRef = doc(db, 'articles', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setArticle({ id: docSnap.id, ...docSnap.data() } as Article);
        } else {
          setArticle(null);
        }
      } catch (err) {
        console.error("Error fetching article:", err);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const handleLike = () => {
    if (!id || !article) return;
    const next = !liked;
    setLiked(next);
    
    // Update localStorage map
    const storedLikes = localStorage.getItem('ig_articles_likes');
    const likesMap = storedLikes ? JSON.parse(storedLikes) : {};
    likesMap[id] = next;
    saveInteraction('ig_articles_likes', likesMap);
    
    if (next) toast.success("已讚好 💖");
  };

  const handleBookmark = () => {
    if (!id || !article) return;
    const next = !bookmarked;
    setBookmarked(next);
    
    const storedBookmarks = localStorage.getItem('ig_articles_bookmarks');
    const bookmarksMap = storedBookmarks ? JSON.parse(storedBookmarks) : {};
    bookmarksMap[id] = next;
    saveInteraction('ig_articles_bookmarks', bookmarksMap);
    
    if (next) toast.success("已儲存 📥");
    else toast.info("已取消儲存");
  };

  const handleAddComment = () => {
    if (!id || !article || !commentText.trim()) return;
    
    const newComment = { user: 'tcg_collector_99', text: commentText.trim(), time: '剛剛' };
    const nextComments = [...comments, newComment];
    setComments(nextComments);
    
    // Save to localStorage
    const storedComments = localStorage.getItem('ig_articles_comments');
    const commentsMap = storedComments ? JSON.parse(storedComments) : {};
    commentsMap[id] = nextComments;
    saveInteraction('ig_articles_comments', commentsMap);
    
    setCommentText('');
    toast.success("已發表留言 💬");
  };

  const handleShare = () => {
    if (!article) return;
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt || article.title,
        url: window.location.href
      }).catch(err => console.log(err));
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("連結已複製 🔗");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-[#fafafa] dark:bg-[#000]">
        <div className="w-12 h-12 border-4 border-[#0095f6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center px-4 text-center bg-[#fafafa] dark:bg-[#000]">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
          <ArrowLeft className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">找不到此文章</h2>
        <button 
          onClick={() => navigate('/articles')}
          className="mt-4 px-6 py-2.5 bg-[#0095f6] text-white rounded-lg font-bold hover:bg-[#1877f2] transition-colors"
        >
          返回文章區
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#000] pb-20">
      {/* Top Navigation Bar - IG Style */}
      <div className="sticky top-0 z-50 bg-white/70 dark:bg-black/70 backdrop-blur-3xl border-b border-black/5 dark:border-white/10">
        <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
          <button 
            onClick={() => navigate('/articles')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-black dark:hover:text-white font-bold transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-gray-900 dark:text-white">openclaw_tcg</span>
            <span className="inline-flex items-center justify-center w-5 h-5 bg-[#0095f6] text-white rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 fill-white text-[#0095f6]" />
            </span>
          </div>
          
          <button onClick={handleShare} className="p-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto bg-white dark:bg-[#121212] border-x border-gray-200 dark:border-white/10">
        
        {/* Author Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="absolute inset-0 -m-0.5 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-full animate-spin-slow duration-1000 p-0.5" />
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-[#000] bg-white">
                <img 
                  src="https://images.unsplash.com/photo-1553531384-cc64ac80f931?auto=format&fit=crop&q=80&w=100"
                  alt="openclaw_tcg"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-gray-900 dark:text-white text-sm">openclaw_tcg</span>
              <span className="ml-1 inline-flex align-middle">
                <CheckCircle2 className="w-3.5 h-3.5 fill-[#0095f6] text-white" />
              </span>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Post Media - Full Width */}
        <div 
          className="relative w-full aspect-square bg-black cursor-pointer"
          onDoubleClick={handleLike}
        >
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/1080/1080`;
            }}
          />
          {/* Category Badge */}
          {article.category && (
            <div className="absolute top-4 right-4 text-xs font-black bg-black/60 backdrop-blur-md text-white rounded-full px-3 py-1">
              {article.category}
            </div>
          )}
        </div>

        {/* Action Icons Row */}
        <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLike}
              className="transition-transform duration-100 hover:scale-110 active:scale-90"
            >
              <Heart className={`w-8 h-8 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-900 dark:text-white'}`} />
            </button>
            
            <button className="hover:scale-110 active:scale-90 transition-transform">
              <MessageCircle className="w-8 h-8 text-gray-900 dark:text-white" />
            </button>
            
            <button onClick={handleShare} className="hover:scale-110 active:scale-90 transition-transform">
              <Send className="w-8 h-8 text-gray-900 dark:text-white" />
            </button>
          </div>
          
          <button 
            onClick={handleBookmark}
            className="hover:scale-110 active:scale-90 transition-transform"
          >
            <Bookmark className={`w-8 h-8 ${bookmarked ? 'fill-gray-900 dark:fill-white' : 'text-gray-900 dark:text-white'}`} />
          </button>
        </div>

        {/* Likes */}
        <div className="px-3.5 pb-2">
          <span className="font-black text-gray-900 dark:text-white text-sm">{liked ? '149' : '148'} 個讚</span>
        </div>

        {/* Caption */}
        <div className="px-3.5 pb-1">
          <span className="font-extrabold text-gray-900 dark:text-white text-sm mr-2">openclaw_tcg</span>
          <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{article.title}</span>
          {article.excerpt && (
            <p className="mt-1 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              {article.excerpt}
            </p>
          )}
        </div>

        {/* Comments Section */}
        {comments.length > 0 && (
          <div className="px-3.5 py-2 border-t border-gray-100 dark:border-white/5">
            {comments.map((c, i) => (
              <div key={i} className="mb-1.5">
                <span className="font-extrabold text-gray-900 dark:text-white text-xs mr-2">{c.user}</span>
                <span className="text-gray-700 dark:text-gray-300 text-xs">{c.text}</span>
                <span className="text-[10px] text-gray-400 ml-2 font-bold">{c.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className="px-3.5 pb-2">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">
            {article.createdAt ? (
              typeof article.createdAt.toDate === 'function'
                ? new Date(article.createdAt.toDate()).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })
                : new Date(article.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })
            ) : '2026年4月7日'}
          </span>
        </div>

        {/* Add Comment Bar - IG Style */}
        <div className="border-t border-gray-100 dark:border-white/5 flex items-center p-3 bg-white dark:bg-[#121212]">
          <input 
            type="text"
            placeholder="發表留言..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            className="flex-1 bg-gray-50 dark:bg-white/5 border-0 rounded-full px-4 py-2.5 text-sm text-gray-950 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20 transition-all"
          />
          <button 
            onClick={handleAddComment}
            disabled={!commentText.trim()}
            className={`ml-2 text-sm font-black transition-colors ${commentText.trim() ? 'text-[#0095f6] hover:text-[#1877f2]' : 'text-gray-300 dark:text-gray-600'}`}
          >
            發佈
          </button>
        </div>
      </div>
    </div>
  );
};