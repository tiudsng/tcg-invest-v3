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
  ArrowLeft
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(true);

  // Security check: Only allow specific admin email
  const isAdmin = user?.email === 'appleyes516@gmail.com';

  const handleSeedLeaderboard = async () => {
    if (!window.confirm('確定要同步排行榜數據嗎？這將會從產品資料庫讀取最新資訊並更新。')) return;
    setIsSeeding(true);
    try {
      // Clear existing rankings
      const querySnapshot = await getDocs(collection(db, 'list_1'));
      for (const d of querySnapshot.docs) {
        await deleteDoc(doc(db, 'list_1', d.id));
      }

      const leaderboardData = [
        {
          card_id: 'charizard_151_sar',
          rank: 1,
          name_zh: '噴火龍 ex (151 SAR)',
          name_jp: 'リザードンex',
          card_number: '201/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/201.png',
          market_data: { snkrdunk_price: 12800, ebay_price: 13500, change_24h: '+2.4%', status: 'up' }
        },
        {
          card_id: 'van_gogh_pikachu',
          rank: 2,
          name_zh: '戴灰氈帽的皮卡丘 (Promo)',
          name_jp: 'ゴッホ ピカチュウ',
          card_number: '085/SVP',
          set_name: 'Promo',
          image_url: 'https://images.pokemontcg.io/svp/85_hires.png',
          psa10_hkd: 28000,
          market_data: { 
            snkrdunk_price: 28000, 
            psa10_price: 26743,
            raw_price: 6160,
            ebay_price: 28000, 
            change_24h: '+5.1%', 
            status: 'up' 
          }
        },
        {
          card_id: 'mew_151_sar',
          rank: 3,
          name_zh: '夢幻 ex (泡泡 SAR)',
          name_jp: 'ミュウex',
          card_number: '205/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/205.png',
          market_data: { snkrdunk_price: 7200, ebay_price: 7200, change_24h: '+1.2%', status: 'up' }
        },
        {
          card_id: 'mewtwo_armor',
          rank: 4,
          name_zh: '武裝夢夢 (特典)',
          name_jp: 'アーマードミュウツー',
          card_number: '365/SM-P',
          set_name: 'SM-P Promo',
          image_url: 'https://images.pokemoncard.io/cards/smp/365.png',
          market_data: { snkrdunk_price: 4500, ebay_price: 4500, change_24h: '0.0%', status: 'stable' }
        },
        {
          card_id: 'umbreon_vmax_sa',
          rank: 5,
          name_zh: '月亮伊布 VMAX (SA)',
          name_jp: 'ブラッキーVMAX',
          card_number: '095/069',
          set_name: 'S6a Eevee Heroes',
          image_url: 'https://images.pokemoncard.io/cards/s6a/95.png',
          market_data: { snkrdunk_price: 18500, ebay_price: 18500, change_24h: '+0.5%', status: 'up' }
        },
        {
          card_id: 'mega_charizard_x_ex_sar',
          rank: 6,
          name_zh: 'Mega 噴火龍 X ex (SAR)',
          name_jp: 'メガリザードンX ex',
          card_number: '110/080',
          set_name: 'SV9',
          image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV9/110.png',
          market_data: { snkrdunk_price: 18500, ebay_price: 18500, change_24h: '+25.4%', status: 'up' }
        },
        {
          card_id: 'lillie_sar_sv9',
          rank: 7,
          name_zh: '莉莉艾 (SAR) - 團隊報恩',
          name_jp: 'リーリエ SAR',
          card_number: '111/080',
          set_name: 'SV9',
          image_url: 'https://limitlesstcg.s3.us-east-2.amazonaws.com/pokemon/jp/SV9/111.png',
          market_data: { snkrdunk_price: 38500, ebay_price: 38500, change_24h: '+12.4%', status: 'up' }
        },
        {
          card_id: 'gengar_masterball',
          rank: 8,
          name_zh: '耿鬼 (151 大師球閃)',
          name_jp: 'ゲンガー',
          card_number: '094/165',
          set_name: 'SV2a 151',
          image_url: 'https://images.pokemoncard.io/cards/sv2a/94.png',
          market_data: { snkrdunk_price: 2800, ebay_price: 2800, change_24h: '+1.8%', status: 'up' }
        },
        {
          card_id: 'ion_sar',
          rank: 9,
          name_zh: '奇樹 (SAR)',
          name_jp: 'ナンジャモ',
          card_number: '357/190',
          set_name: 'SV4a',
          image_url: 'https://images.pokemoncard.io/cards/sv4a/357.png',
          market_data: { snkrdunk_price: 1900, ebay_price: 1900, change_24h: '-0.5%', status: 'down' }
        },
        {
          card_id: 'charizard_y_sv9',
          rank: 10,
          name_zh: 'Mega 噴火龍 Y ex (SAR)',
          name_jp: 'メガリザードンY',
          card_number: 'SV9',
          set_name: 'SV9',
          image_url: 'https://placehold.co/400x560/1c1c1e/d4af37?text=Charizard+Y+SV9',
          market_data: { snkrdunk_price: 9500, ebay_price: 9500, change_24h: '+15.0%', status: 'up' }
        }
      ];

      for (const item of leaderboardData) {
        // Try to FIND corresponding data in products collection
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef, 
          where('card_number', '==', item.card_number)
        );
        const productSnap = await getDocs(q);
        
        let finalData: any = { ...item };
        
        if (!productSnap.empty) {
          // Find the best match if multiple products have same card number (e.g. by name)
          let productData = productSnap.docs[0].data();
          if (productSnap.docs.length > 1) {
            const exactNameMatch = productSnap.docs.find(d => d.data().name_zh === item.name_zh);
            if (exactNameMatch) productData = exactNameMatch.data();
          }

          // Merge data, prioritizing product data for market info, metadata AND image
          const productMarket = (productData.market_data || {}) as any;
          const itemMarket = (item.market_data || {}) as any;

          finalData = {
            ...productData, // Start with product data
            ...item,        // Overwrite with leaderboard specific fields (rank, card_id, names)
            id: item.card_id,
            market_data: {
              ...itemMarket,
              ...productMarket,
              // Force these to exist
              snkrdunk_price: productMarket.snkrdunk_price || itemMarket.snkrdunk_price || productData.price || 0,
              ebay_price: productMarket.ebay_price || itemMarket.ebay_price || productData.price || 0,
            },
            image_url: productData.imageUrl || productData.image_url || item.image_url, 
            rank: item.rank
          };
        } else {
          finalData = {
            ...item,
            id: item.card_id
          };
        }
        
        await setDoc(doc(db, 'list_1', item.card_id), finalData);
      }

      toast.success('排行榜已同步最新數據！');
      // Refresh stats
      const leaderboardSnap = await getDocs(collection(db, 'list_1'));
      setStats(prev => ({ ...prev, totalLeaderboard: leaderboardSnap.size }));
    } catch (error) {
      console.error("Error seeding leaderboard:", error);
      toast.error('更新失敗');
    } finally {
      setIsSeeding(false);
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
        const leaderboardSnap = await getDocs(collection(db, 'list_1'));
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">排行榜項目</p>
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
