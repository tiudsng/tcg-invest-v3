import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ArrowLeft, Search, Star, Trash2, Plus, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { getHighResImage, handleImageError, getImageClass } from './lib/imageUtils';
import { cleanMarketData } from './lib/priceUtils';

const MOCK_PRODUCTS: Record<string, any> = {
  'override_van_gogh_pikachu': {
    id: 'override_van_gogh_pikachu',
    card_id: 'van_gogh_pikachu_en',
    rank: 2,
    name_zh: '戴灰氈帽的皮卡丘 (Promo)',
    name_jp: 'Pikachu with Grey Felt Hat',
    card_number: '085',
    set_name: 'SVP Black Star Promos',
    image_url: 'https://images.pokemontcg.io/svp/85_hires.png',
    market_data: { snkrdunk_price: 8800, ebay_price: 8800, change_24h: '+5.1%', status: 'up' }
  },
  'override_mew_ex_sv2a': {
    id: 'override_mew_ex_sv2a',
    card_id: 'mew_ex_sv2a',
    rank: 3,
    name_zh: '夢幻 ex (泡泡 SAR)',
    name_jp: 'ミュウex',
    card_number: '205/165',
    set_name: 'SV2a',
    image_url: 'https://den-cards.pokellector.com/371/Mew-ex.SV2A.205.48354.png',
    market_data: { snkrdunk_price: 7200, ebay_price: 7200, change_24h: '+1.2%', status: 'up' }
  },
  'override_mew_ex': {
    id: 'override_mew_ex',
    card_id: 'mew_ex_usgmen',
    rank: 1,
    name_zh: '夢幻 ex (SAR)',
    name_jp: 'ミュウex',
    card_number: '347/190',
    set_name: 'SV4a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    market_data: { snkrdunk_price: 15828, ebay_price: 15828, change_24h: '+15.4%', status: 'up' }
  }
};

interface CollectedCard {
  id: string; // Document ID
  card_id: string;
  name_zh: string;
  name_jp?: string;
  set_name?: string;
  card_number: string;
  image_url: string;
  addedAt: any;
  market_data?: {
    snkrdunk_price?: number;
    ebay_price?: number;
    change_24h?: string;
  };
}

export const MyCollection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<CollectedCard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchCode, setSearchCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const q = query(collection(db, 'user_collections'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          market_data: cleanMarketData(doc.id, data)
        };
      }) as CollectedCard[];
      // Sort client-side by addedAt if present, or fallback
      docs.sort((a, b) => {
        const timeA = a.addedAt?.toMillis ? a.addedAt.toMillis() : 0;
        const timeB = b.addedAt?.toMillis ? b.addedAt.toMillis() : 0;
        return timeB - timeA;
      });
      setCollections(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching collection:", error);
      toast.error('無法載入收藏，請稍後再試');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCode.trim()) {
      toast.error('請輸入卡號');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const code = searchCode.trim();
      
      // 1. Check Mock Overrides First
      const mockResult = Object.values(MOCK_PRODUCTS).find(p => p.card_number === code || p.card_number.includes(code));
      
      // 2. Fetch from normal products
      const q = query(collection(db, 'products'), where('card_number', '==', code));
      const snap = await getDocs(q);
      
      const results: any[] = [];
      if (mockResult) {
        results.push(mockResult);
      }
      
      if (!snap.empty) {
        snap.docs.forEach(d => {
          if (!results.some(r => r.card_number === d.data().card_number && r.name_zh === d.data().name_zh)) {
             const data = d.data();
             results.push({ 
               id: d.id, 
               ...data,
               market_data: cleanMarketData(d.id, data)
             });
          }
        });
      }
      
      if (results.length === 0) {
        setSearchError('找不到該卡號的資料，請確認輸入正確 (例: 201/165)');
        setSearchResults([]);
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchError('搜尋發生錯誤，請稍後再試');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddCollection = async (product: any) => {
    if (!user) return;
    
    // Check if already collected
    if (collections.some(c => c.card_id === product.id || c.card_id === product.card_id)) {
      toast.error('此卡片已經在您的收藏中囉！');
      return;
    }

    try {
      await addDoc(collection(db, 'user_collections'), {
        userId: user.uid,
        card_id: product.id || product.card_id,
        name_zh: product.name_zh,
        name_jp: product.name_jp || '',
        set_name: product.set_name || '',
        card_number: product.card_number || '',
        image_url: product.image_url || product.imageUrl || '',
        market_data: product.market_data || {},
        addedAt: serverTimestamp()
      });
      toast.success('已成功加入收藏！');
      setSearchCode('');
      setSearchResults([]);
    } catch (error) {
      console.error("Error adding to collection:", error);
      toast.error('加入失敗，請稍後再試');
    }
  };

  const handleRemoveCollection = async (docId: string, cardName: string) => {
    if (!window.confirm(`確定要將「${cardName}」移出收藏嗎？`)) return;
    try {
      await deleteDoc(doc(db, 'user_collections', docId));
      toast.success('已移出收藏');
    } catch (error) {
      console.error("Error removing from collection:", error);
      toast.error('移除失敗');
    }
  };

  const calculateTotalValue = () => {
    return collections.reduce((total, item) => {
      const price = item.market_data?.snkrdunk_price || item.market_data?.ebay_price || 0;
      return total + price;
    }, 0);
  };

  const getCardImage = (item: CollectedCard) => {
    return getHighResImage(item.image_url, item.name_zh || item.name_jp, `${item.set_name}|${item.card_number}`, item.card_id);
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] pt-28 sm:pt-40 pb-32 px-4 sm:px-6 transition-colors duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-2">
          <div className="space-y-3">
            <motion.button 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleBack}
              className="group flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold mb-2 hover:opacity-70 transition-opacity"
            >
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span>返回上一頁</span>
            </motion.button>
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-4xl font-black tracking-tight"
            >
              我的收藏
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-base text-gray-500 dark:text-gray-400 font-medium tracking-tight"
            >
              紀錄與追蹤您的珍貴卡牌
            </motion.p>
          </div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="hidden sm:block"
          >
            <Star className="w-12 h-12 text-amber-500 fill-amber-500" />
          </motion.div>
        </div>

        {/* Stats Summary - Apple Bento Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 border border-gray-100 dark:border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 opacity-80">收藏總數</p>
              <p className="text-3xl font-black tracking-tighter tabular-nums text-gray-900 dark:text-white">
                {collections.length} <span className="text-sm text-gray-300 dark:text-gray-600 font-bold">張</span>
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-green-500 font-bold text-[9px] bg-green-500/10 self-start px-2 py-1 rounded-full uppercase tracking-wider">
              <TrendingUp className="w-3 h-3" />
              <span>追蹤中</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-5 border border-gray-100 dark:border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col justify-between"
          >
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 opacity-80 font-sans flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-[#d4af37]" /> 估算價值
              </p>
              <p className="text-2xl sm:text-3xl font-black tracking-tighter text-[#d4af37] flex items-baseline gap-0.5 tabular-nums">
                <span className="text-sm">$</span>
                {calculateTotalValue().toLocaleString()}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-gray-400 font-bold text-[9px] uppercase tracking-widest opacity-60">
              <span>HKD</span>
            </div>
          </motion.div>
        </div>

        {/* Search / Add Module - Elevated Glassy Input */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-[#1c1c1e] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">新增至我的收藏</h2>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 relative">
            <div className="relative flex-grow group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="輸入卡號搜尋 (例: 201/165)"
                className="w-full bg-gray-50 dark:bg-black/40 border-2 border-transparent focus:border-blue-500/30 rounded-xl py-3.5 pl-11 pr-4 text-base font-bold focus:ring-0 outline-none transition-all placeholder:text-gray-400 dark:text-white shadow-inner"
              />
            </div>
            <button 
              type="submit" 
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-black text-base disabled:bg-gray-200 dark:disabled:bg-gray-800 transition-all active:scale-95 shadow-lg shadow-blue-600/10 flex items-center justify-center min-w-[120px]"
            >
              {isSearching ? <RefreshCw className="w-5 h-5 animate-spin" /> : '追蹤其卡牌'}
            </button>
          </form>

          <AnimatePresence>
            {searchError && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2 text-sm font-bold">
                <AlertCircle className="w-5 h-5" /> {searchError}
              </motion.div>
            )}

            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">搜尋結果</p>
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-white/10">
                    <div className="w-16 h-24 flex items-center justify-center overflow-hidden rounded">
                      <img src={getCardImage(result as any)} alt={result.name_zh} className={getImageClass(getCardImage(result as any))} referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-sm">{result.name_zh}</h3>
                      <p className="text-xs text-gray-500 mt-1">{result.set_name} • {result.card_number}</p>
                      <p className="text-xs font-bold text-[#d4af37] mt-1">HK$ {result.market_data?.snkrdunk_price?.toLocaleString() || result.market_data?.ebay_price?.toLocaleString() || '---'}</p>
                    </div>
                    <button 
                      onClick={() => handleAddCollection(result)}
                      className="p-3 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors"
                      title="加入收藏"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Collection Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">我的珍藏展示櫃</h2>
            <div className="px-4 py-1.5 bg-gray-200 dark:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {collections.length} ITEMS
            </div>
          </div>
          
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 font-bold tracking-widest text-xs uppercase animate-pulse">讀取收藏中...</p>
            </div>
          ) : collections.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white dark:bg-[#1c1c1e] rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100 dark:border-white/5"
            >
              <div className="w-24 h-24 bg-gray-50 dark:bg-[#111] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <Star className="w-12 h-12 text-gray-200 dark:text-gray-700" />
              </div>
              <p className="font-black text-gray-900 dark:text-white text-2xl mb-2 tracking-tight">您的展示櫃空空如也</p>
              <p className="text-gray-400 font-medium mb-8">趕快搜尋喜愛的卡牌並加入追蹤清單吧！</p>
              <button 
                onClick={() => document.querySelector('input')?.focus()}
                className="px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-black text-sm active:scale-95 transition-all"
              >
                立即搜尋
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-8">
              <AnimatePresence mode="popLayout">
                {collections.map((item, index) => (
                  <motion.div 
                    key={item.id} 
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05, type: "spring", damping: 20 }}
                    className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-gray-100 dark:border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col group relative transition-all hover:shadow-[0_20px_64px_rgba(0,0,0,0.08)]"
                  >
                    <div 
                      className="absolute top-4 right-4 z-20 p-2.5 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-xl shadow-xl shadow-red-500/20 active:scale-90"
                      onClick={() => handleRemoveCollection(item.id, item.name_zh)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </div>
                    
                    <div 
                      className="aspect-[3/4] bg-gray-50 dark:bg-black p-4 flex items-center justify-center cursor-pointer overflow-hidden"
                      onClick={() => navigate(`/product/${item.card_id}`)}
                    >
                      <img 
                        src={getCardImage(item)} 
                        alt={item.name_zh}
                        className={`max-w-full max-h-full transition-transform duration-700 group-hover:scale-110 drop-shadow-2xl ${getImageClass(getCardImage(item))}`}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, item.image_url, item.name_zh)}
                      />
                    </div>
                    
                    <div 
                      className="p-5 flex-1 flex flex-col cursor-pointer bg-white dark:bg-[#1c1c1e]"
                      onClick={() => navigate(`/product/${item.card_id}`)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 tracking-tighter">
                          {item.card_number}
                        </span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{item.set_name}</span>
                      </div>
                      
                      <h3 className="font-black text-base sm:text-lg leading-tight text-gray-900 dark:text-white mb-3 line-clamp-2 truncate tracking-tight">{item.name_zh}</h3>
                      
                      <div className="mt-auto pt-4 border-t border-gray-50 dark:border-white/5 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-0.5">目前市值</p>
                          <p className="font-black text-xl text-blue-600 dark:text-blue-400 tracking-tighter tabular-nums">
                            HK$ {(item.market_data?.snkrdunk_price || item.market_data?.ebay_price || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                          <Plus className="w-4 h-4 text-gray-300 group-hover:text-white group-hover:rotate-90 transition-all" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
