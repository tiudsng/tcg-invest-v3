import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { 
  Shield, 
  Users, 
  Package, 
  AlertTriangle, 
  Search, 
  ChevronRight, 
  Trash2, 
  CheckCircle,
  BarChart3,
  Settings as SettingsIcon,
  ArrowLeft,
  Activity,
  Loader2
} from 'lucide-react';
import { collection, getDocs, getDoc, query, orderBy, limit, deleteDoc, doc, setDoc, updateDoc, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { syncLeaderboard } from './lib/leaderboardService';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';

export const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    totalWants: 0,
    totalLeaderboard: 0,
    totalProducts: 0,
    totalArticles: 0
  });
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [newArticle, setNewArticle] = useState({
    title: '',
    category: '情報分析',
    content: '',
    imageUrl: '',
    author: 'OPENCLAW 小龍蝦',
    zone: 0
  });
  const [isSubmittingArticle, setIsSubmittingArticle] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isUpdatingPsa, setIsUpdatingPsa] = useState(false);
  const [isSyncingStorage, setIsSyncingStorage] = useState(false);
  const [psaUpdateProgress, setPsaUpdateProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Security check: Only allow specific admin email
  const isAdmin = user?.email === 'appleyes516@gmail.com';

  const handleSeedLeaderboard = async () => {
    setIsSeeding(true);
    const loadingToast = toast.loading('正在準備同步排行榜...');
    
    try {
      // 1. Get mappings from config
      const configSnap = await getDoc(doc(db, 'config', 'leaderboard'));
      let rankings: string[] = [
        'snkrdunk_146897', 'snkrdunk_107574', 'snkrdunk_164250', 'snkrdunk_128121',
        'snkrdunk_128117', 'snkrdunk_103080', 'snkrdunk_91323', 'snkrdunk_469638',
        'snkrdunk_186243', 'snkrdunk_93021'
      ];

      if (configSnap.exists()) {
         const data = configSnap.data();
         if (data.rankings && Array.isArray(data.rankings)) {
            rankings = data.rankings;
         }
      }

      // 2. Sync all cards in PARALLEL for better performance
      const syncPromises = rankings.map((cardId, i) => {
        if (!cardId) return Promise.resolve();
        const rankKey = `rank_${(i + 1).toString().padStart(2, '0')}`;
        toast.loading(`正在同步 NO.${i+1}: ${cardId}...`, { id: loadingToast });
        return fetch('/api/sync-single-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rankKey, cardId })
        }).then(async res => {
          if (!res.ok) {
            let errMsg = `伺服器回應錯誤 (${res.status})`;
            try {
              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errData = await res.json();
                errMsg = errData.error || errMsg;
              }
            } catch (e) {}
            console.warn(`Failed to sync ${rankKey}:`, errMsg);
          }
        }).catch(err => {
          console.warn(`Network error syncing ${rankKey}:`, err);
        });
      });
      
      await Promise.all(syncPromises);
      
      toast.success('排行榜數據同步完成！', { id: loadingToast });
      // Refresh stats
      const leaderboardSnap = await getDocs(collection(db, 'leaderboard'));
      setStats(prev => ({ ...prev, totalLeaderboard: leaderboardSnap.size }));
    } catch (error: any) {
      console.error('Error seeding leaderboard:', error);
      toast.error(`同步失敗: ${error.message}`, { id: loadingToast });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdatePsaPop = async () => {
    // ... existing ...
  };

  const handleStorageSync = async () => {
    setIsSyncingStorage(true);
    const loadingToast = toast.loading('正在同步圖片到 Firebase Storage...');
    
    try {
      const targets = [
        { 
          id: 'snkrdunk_107574', 
          url: 'https://www.pokemon-card.com/assets/images/card_images/large/SMP/036987_P_AMADOMYUUTSU.jpg' 
        },
        { 
          id: 'snkrdunk_128121', 
          url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV2a/043990_P_MIXYUUEX.jpg' 
        }
      ];

      for (const target of targets) {
        toast.loading(`正在下載與上傳 ${target.id}...`, { id: loadingToast });
        
        // Use the proxy to avoid CORS
        const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(target.url)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        const fileRef = ref(storage, `card_images/${target.id}.jpg`);
        
        // Upload
        await uploadBytes(fileRef, blob, {
          contentType: blob.type || 'image/jpeg'
        });
        
        // Get URL
        const downloadUrl = await getDownloadURL(fileRef);
        console.log(`[Storage] Uploaded ${target.id} to ${downloadUrl}`);
        
        // Update Firestore
        await updateDoc(doc(db, 'products', target.id), {
          image_url: downloadUrl
        });
        
        // Also update leaderboard if matches
        const leaderboardSnap = await getDocs(query(collection(db, 'leaderboard'), where('card_id', '==', target.id)));
        for (const lDoc of leaderboardSnap.docs) {
          await updateDoc(lDoc.ref, { image_url: downloadUrl });
        }
      }

      toast.success('圖片存儲同步完成！', { id: loadingToast });
    } catch (error: any) {
      console.error("Error syncing storage:", error);
      toast.error(`同步儲存出錯: ${error.message}`, { id: loadingToast });
    } finally {
      setIsSyncingStorage(false);
    }
  };

  useEffect(() => {
    if (!isAdmin && user !== undefined) {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const listingsSnap = await getDocs(collection(db, 'listings'));
        const wantsSnap = await getDocs(collection(db, 'wantListings'));
        const leaderboardSnap = await getDocs(collection(db, 'leaderboard'));
        const productsSnap = await getDocs(collection(db, 'products'));
        const articlesSnap = await getDocs(collection(db, 'articles'));

        setStats({
          totalUsers: usersSnap.size,
          totalListings: listingsSnap.size,
          totalWants: wantsSnap.size,
          totalLeaderboard: leaderboardSnap.size,
          totalProducts: productsSnap.size,
          totalArticles: articlesSnap.size
        });

        const recentQuery = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(5));
        const recentSnap = await getDocs(recentQuery);
        setRecentListings(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin, user, navigate]);

  const handleDeleteListing = async (id: string) => {
    if (!window.confirm('確定要刪除此商品嗎？')) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
      setRecentListings(prev => prev.filter(item => item.id !== id));
      toast.success('商品已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  const handlePostArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticle.title || !newArticle.content) {
      toast.error('標題與內容為必填');
      return;
    }

    setIsSubmittingArticle(true);
    try {
      const { serverTimestamp, addDoc } = await import('firebase/firestore');
      await addDoc(collection(db, 'articles'), {
        ...newArticle,
        createdAt: serverTimestamp(),
        readTime: `${Math.ceil(newArticle.content.length / 500)} min read`
      });
      toast.success('文章已發佈！');
      setShowArticleModal(false);
      setNewArticle({
        title: '',
        category: '情報分析',
        content: '',
        imageUrl: '',
        author: 'OPENCLAW 小龍蝦',
        zone: 0
      });
      // Refresh stats
      const articlesSnap = await getDocs(collection(db, 'articles'));
      setStats(prev => ({ ...prev, totalArticles: articlesSnap.size }));
    } catch (error) {
      console.error("Error posting article:", error);
      toast.error('發佈失敗');
    } finally {
      setIsSubmittingArticle(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pt-24 sm:pt-32 pb-32 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-500" /> 管理後台
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理網站數據與內容</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> 系統運行正常
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總用戶數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-3/4 rounded-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總商品數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalListings}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-1/2 rounded-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總徵卡數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalWants}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-1/4 rounded-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">十大熱門項目</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalLeaderboard}</p>
              </div>
            </div>
            <button 
              onClick={handleSeedLeaderboard}
              disabled={isSeeding}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-2"
            >
              {isSeeding ? '更新中...' : '同步最新清單'}
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border-2 border-amber-500/20 dark:border-amber-500/30 shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">數據維護</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">PSA 人口數據</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mb-4 font-bold">僅更新 Products 集合中的 PSA Population (人口) 數據，不更新市場價格。</p>
            {isUpdatingPsa && (
              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-bold text-amber-500 mb-1">
                  <span>進度</span>
                  <span>{psaUpdateProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300" 
                    style={{ width: `${psaUpdateProgress}%` }} 
                  />
                </div>
              </div>
            )}
            <button 
              onClick={handleUpdatePsaPop}
              disabled={isUpdatingPsa}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {isUpdatingPsa ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  執行中...
                </>
              ) : (
                '更新 PSA 人口數據 (不含價格)'
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border-2 border-orange-500/20 dark:border-orange-500/30 shadow-lg relative overflow-hidden">
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">儲存空間維護</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">圖片存儲同步</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mb-4 font-bold">下載官方圖片並上傳至 Firebase Storage，然後更新資料庫連結。</p>
            <button 
              onClick={handleStorageSync}
              disabled={isSyncingStorage}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              {isSyncingStorage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  同步中...
                </>
              ) : (
                '同步圖片到 Storage'
              )}
            </button>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-500/10 flex items-center justify-center text-gray-600 dark:text-gray-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Legacy Products (保留)</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalProducts}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gray-500 w-full rounded-full opacity-30" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">小龍蝦文章</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalArticles}</p>
              </div>
            </div>
            <button 
              onClick={() => setShowArticleModal(true)}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black transition-colors"
            >
              快速發佈
            </button>
          </div>
        </div>

        {/* Article Post Modal */}
        <AnimatePresence>
          {showArticleModal && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowArticleModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-[#111] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/5"
              >
                <form onSubmit={handlePostArticle} className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">發佈小龍蝦情報</h2>
                    <button type="button" onClick={() => setShowArticleModal(false)} className="p-2 text-gray-400 hover:text-white">
                      <Trash2 className="w-6 h-6 rotate-45" />
                    </button>
                  </div>
                  
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">標題</label>
                      <input 
                        type="text"
                        value={newArticle.title}
                        onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                        className="w-full p-4 bg-gray-50 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500"
                        placeholder="請輸入文章標題..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">分類</label>
                        <select 
                          value={newArticle.category}
                          onChange={(e) => setNewArticle({...newArticle, category: e.target.value})}
                          className="w-full p-4 bg-gray-50 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white"
                        >
                          <option>情報分析</option>
                          <option>卡片投資</option>
                          <option>賽事報導</option>
                          <option>深度專欄</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">展示區域 (Zone)</label>
                        <select 
                          value={newArticle.zone}
                          onChange={(e) => setNewArticle({...newArticle, zone: parseInt(e.target.value)})}
                          className="w-full p-4 bg-gray-50 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white"
                        >
                          <option value="0">一般分頁 (不置頂)</option>
                          <option value="1">首頁置頂 - 大位 (Zone 1)</option>
                          <option value="2">首頁置頂 - 中右 (Zone 2)</option>
                          <option value="3">首頁置頂 - 下右 (Zone 3)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">封面圖片 URL</label>
                      <input 
                        type="text"
                        value={newArticle.imageUrl}
                        onChange={(e) => setNewArticle({...newArticle, imageUrl: e.target.value})}
                        className="w-full p-4 bg-gray-50 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">內容 (支援 Markdown)</label>
                      <textarea 
                        value={newArticle.content}
                        onChange={(e) => setNewArticle({...newArticle, content: e.target.value})}
                        rows={8}
                        className="w-full p-4 bg-gray-50 dark:bg-white/5 border-0 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 font-mono"
                        placeholder="# 標題內容..."
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingArticle}
                    className="w-full py-5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all"
                  >
                    {isSubmittingArticle ? <div className="w-6 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" /> : '立即發佈文章'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> 最近上架
            </h2>
            <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">查看全部</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentListings.length === 0 ? (
              <div className="p-12 text-center text-gray-500">暫無數據</div>
            ) : (
              recentListings.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <img 
                      src={item.imageUrl} 
                      alt={item.title} 
                      className="w-12 h-12 rounded-xl object-cover bg-gray-100"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500">HK$ {item.price} • {item.sellerName || '未知賣家'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => navigate(`/listing/${item.id}`)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteListing(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Settings Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> 系統配置
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Gemini AI API</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Firebase Firestore</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Firebase Auth</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> 安全提示
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              管理後台僅限管理員訪問。請確保您的 API 金鑰已在系統設置中正確配置。
              所有刪除操作均不可逆，請謹慎操作。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
