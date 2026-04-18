import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ArrowLeft, Search, Star, Trash2, Plus, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

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
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CollectedCard[];
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
      // Allow searching by exact card_number or substring if possible. 
      // Firestore '==' is exact match. For flexibility, we look for exact match first.
      const q = query(collection(db, 'products'), where('card_number', '==', searchCode.trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setSearchError('找不到該卡號的資料，請確認輸入正確 (例: 201/165)');
        setSearchResults([]);
      } else {
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#000000] text-[#1d1d1f] dark:text-[#f5f5f7] pt-6 pb-32 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/profile')}
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2 tracking-tight">
              <Star className="w-7 h-7 text-amber-500 fill-amber-500" /> 我的收藏
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">紀錄與追蹤您的珍貴卡牌</p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 sm:p-8 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">總收藏數量</p>
            <p className="text-4xl font-black tracking-tighter">{collections.length} <span className="text-xl text-gray-500">張</span></p>
          </div>
          <div className="h-px sm:h-12 w-full sm:w-px bg-gray-100 dark:bg-white/10" />
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-[#d4af37]" /> 估算總價值 (HK$)</p>
            <p className="text-4xl font-black text-[#d4af37] tracking-tighter cursor-help" title="基於 SNKRDUNK 或 eBay 的最近報價估算">
              ${calculateTotalValue().toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search / Add Module */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 border border-gray-100 dark:border-white/5 shadow-sm">
          <h2 className="text-lg font-black mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" /> 新增卡片
          </h2>
          <form onSubmit={handleSearch} className="flex gap-3 relative">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="輸入卡號搜尋 (例: 201/165, 085/SVP)"
                className="w-full bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <button 
              type="submit" 
              disabled={isSearching}
              className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-black text-sm disabled:opacity-50 transition-transform active:scale-95"
            >
              {isSearching ? <RefreshCw className="w-5 h-5 animate-spin" /> : '搜尋'}
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
                    <img src={result.image_url || result.imageUrl || `https://picsum.photos/seed/${result.card_number}/100/140`} alt={result.name_zh} className="w-16 h-24 object-contain rounded" referrerPolicy="no-referrer" />
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
        </div>

        {/* Collection Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-black mt-8 mb-4 tracking-tight">我的展示櫃</h2>
          
          {loading ? (
            <div className="py-20 flex justify-center">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-12 text-center border border-gray-100 dark:border-white/5 border-dashed">
              <div className="w-16 h-16 bg-gray-50 dark:bg-[#111] rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="font-bold text-gray-500">展示櫃空空如也</p>
              <p className="text-xs text-gray-400 mt-2">請從上方使用卡號搜尋並加入您的卡牌</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {collections.map((item) => (
                <div key={item.id} className="bg-white dark:bg-[#1c1c1e] rounded-[1.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col group relative">
                  <div 
                    className="absolute top-2 right-2 z-10 p-2 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-md"
                    onClick={() => handleRemoveCollection(item.id, item.name_zh)}
                    title="移出收藏"
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                  
                  <div 
                    className="aspect-[3/4] bg-gray-50 dark:bg-[#111] p-4 flex items-center justify-center cursor-pointer"
                    onClick={() => navigate(`/product/${item.card_id}`)}
                  >
                    <img 
                      src={item.image_url || `https://picsum.photos/seed/${item.card_id}/400/560`} 
                      alt={item.name_zh}
                      className="max-w-full max-h-full object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div 
                    className="p-4 flex-1 flex flex-col cursor-pointer"
                    onClick={() => navigate(`/product/${item.card_id}`)}
                  >
                    <div className="text-[10px] font-black text-gray-400 mb-1">{item.card_number} {item.set_name ? `• ${item.set_name}` : ''}</div>
                    <h3 className="font-bold text-sm leading-tight mb-2 line-clamp-2 flex-1">{item.name_zh}</h3>
                    <div className="flex items-baseline justify-between mt-auto">
                      <span className="font-black text-[#d4af37]">
                        HK$ {item.market_data?.snkrdunk_price?.toLocaleString() || item.market_data?.ebay_price?.toLocaleString() || '---'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
