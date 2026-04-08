import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ArrowLeft, Clock, User, Calendar, Share2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { ARTICLES } from './articleData';

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
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      // First check static data
      const staticArticle = ARTICLES.find(a => a.id === id);
      if (staticArticle) {
        // Mock content for static articles if missing
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
          setError('找不到此文章');
        }
      } catch (err) {
        console.error("Error fetching article:", err);
        setError('載入失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error || '找不到此文章'}</h2>
        <button 
          onClick={() => navigate(-1)}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          返回上一頁
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] pb-32">
      {/* Header Image */}
      <div className="relative w-full h-[40vh] sm:h-[60vh] overflow-hidden">
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/1920/1080?blur=4`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0a0a0a] to-transparent" />
        
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 w-10 h-10 bg-black/20 dark:bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors z-10"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-20 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111] rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-gray-100 dark:border-white/5"
        >
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {article.category && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider">
                {article.category}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{article.readTime || '5 min read'}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white leading-tight mb-8">
            {article.title}
          </h1>

          <div className="flex items-center justify-between py-6 border-y border-gray-100 dark:border-white/5 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shadow-lg">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="block font-bold text-gray-900 dark:text-white">{article.author || 'OPENCLAW 小龍蝦'}</span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {article.createdAt ? (
                    typeof article.createdAt.toDate === 'function' 
                      ? new Date(article.createdAt.toDate()).toLocaleDateString()
                      : new Date(article.createdAt).toLocaleDateString()
                  ) : '2026/04/07'}
                </span>
              </div>
            </div>
            <button className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-full text-gray-500 hover:text-blue-500 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-gray-600 dark:prose-p:text-gray-300 prose-img:rounded-3xl">
            <ReactMarkdown
              components={{
                img: ({ node, ...props }) => (
                  <img
                    {...props}
                    className="rounded-3xl shadow-lg my-8 w-full"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}_content/800/500?blur=1`;
                    }}
                  />
                )
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
