import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Listing } from './types';
import { useAuth } from './AuthContext';
import { ArrowLeft, MessageCircle, ShieldCheck, Star, Clock, Share2, AlertCircle, Maximize2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ConditionBadge } from './components/ConditionBadge';
import { FavoriteButton } from './components/FavoriteButton';
import { ImageCarousel } from './components/ImageCarousel';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setListing({ id: docSnap.id, ...docSnap.data() } as Listing);
        } else {
          setError('找不到此商品');
        }
      } catch (err) {
        console.error("Error fetching listing:", err);
        setError('載入失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error || '找不到此商品'}</h2>
        <button 
          onClick={() => navigate(-1)}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
        >
          返回上一頁
        </button>
      </div>
    );
  }

  const handleContactSeller = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // In a real app, this would navigate to a chat room with the seller
    toast.info('即將開放聊天功能！');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-40">
      {/* iOS Style Transparent Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/10 px-4 h-16 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 active:scale-90 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">商品詳情</span>
        <button 
          onClick={() => toast.success('已複製連結')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 active:scale-90 transition-all text-blue-600 dark:text-blue-400"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-screen-md mx-auto pt-20">
        {/* Immersive Image Section */}
        <div className="px-4 sm:px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-2xl bg-gray-100 dark:bg-[#1c1c1e]"
          >
            <div onClick={() => setIsZoomed(true)} className="w-full h-full cursor-zoom-in">
              <ImageCarousel 
                images={listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls : (listing.imageUrl ? [listing.imageUrl] : [])} 
                title={listing.title} 
                id={listing.id} 
              />
            </div>

            {/* Favorite - Minimal Obstruct Top Right */}
            <div className="absolute top-4 right-4 z-10 pointer-events-none">
              <div className="w-9 h-9 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 transition-all pointer-events-auto cursor-pointer">
                <FavoriteButton listingId={listing.id} className="scale-100 !text-white opacity-90" />
              </div>
            </div>

            {/* Zoom - Minimal Obstruct Bottom Right */}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }}
              className="absolute bottom-4 right-4 z-10 w-8 h-8 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all"
            >
              <Maximize2 className="w-4 h-4 opacity-90" />
            </button>
          </motion.div>
        </div>

        {/* Info Rows Below Image */}
        <div className="mt-6 space-y-6">

          {/* Details Section */}
          <div className="px-6 space-y-8">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex-1 line-clamp-2">
                   {listing.title}
                </h1>
                <ConditionBadge 
                  condition={listing.condition} 
                  cardType={listing.cardType} 
                  title={listing.title} 
                  className="shadow-sm ml-2" 
                />
              </div>
              {listing.englishName && (
                <p className="text-gray-500 font-medium mb-4">{listing.englishName}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-4xl font-black text-blue-600 dark:text-blue-400 truncate max-w-full">
                  HK${listing.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Specification List - iOS Style */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1">詳細資訊</h3>
              <div className="bg-gray-50 dark:bg-white/5 rounded-3xl overflow-hidden divide-y divide-gray-100 dark:divide-white/5">
                {[
                  { label: "卡號碼", value: listing.cardNumber || '--' },
                  { label: "評級狀態", value: listing.condition || '--', color: "text-blue-600 dark:text-blue-400" },
                  { label: "PSA 10 人口", value: listing.condition === 'PSA 10' ? '1,248' : (listing.cardType === 'PSA' ? '獲取中...' : '不適用') },
                  { label: "商品標籤", value: listing.tags?.join(', ') || '--' },
                  { label: "上架時間", value: listing.createdAt ? (typeof listing.createdAt.toDate === 'function' ? new Date(listing.createdAt.toDate()).toLocaleDateString() : new Date(listing.createdAt).toLocaleDateString()) : '未知' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-white/10 transition-colors">
                    <span className="text-gray-500 font-medium">{item.label}</span>
                    <span className={`font-semibold ${item.color || 'text-gray-900 dark:text-white'}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="pb-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider px-1 mb-4">賣家描述</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/5 p-5 rounded-3xl">
                {listing.description || '該賣家非常懶，沒有留下任何描述...'}
              </p>
            </div>

            {/* Product Q&A / Comments */}
            <div className="pb-8">
              <div className="flex items-center justify-between px-1 mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">商品問與答</h3>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">3 則留言</span>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-5 space-y-4">
                {/* Mock Comment 1 */}
                <div className="pb-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase">Player_One</span>
                    <span className="text-[10px] text-gray-400 font-medium">1小時前</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">請問這張卡還有議價空間嗎？</p>
                  <div className="mt-2 pl-4 border-l-2 border-blue-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">賣家回覆</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">價錢已經非常甜了，可以私訊再議喔！</p>
                  </div>
                </div>
                {/* Mock Comment 2 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase">Collector_V</span>
                    <span className="text-[10px] text-gray-400 font-medium">3小時前</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">請問可以面交嗎？地點在哪？</p>
                </div>
                {/* Input placeholder */}
                <div className="pt-2">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="留個言問問賣家..." 
                      className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                    <button className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                      傳送
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Single Unified Seller & Reviews Card */}
            <div className="space-y-6 pb-8">
              <div className="bg-[#111] dark:bg-[#111] rounded-[2rem] p-5 shadow-2xl relative overflow-hidden">
                {/* Subtle gradient effect */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex gap-4 items-center">
                    <div className="relative">
                      <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center p-1 relative z-10 overflow-hidden">
                        {listing.sellerPhoto ? (
                          <img src={listing.sellerPhoto} alt={listing.sellerName} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="font-black text-2xl text-blue-600">{listing.sellerName.charAt(0)}</span>
                        )}
                      </div>
                      {/* Active green dot */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00d859] rounded-full border-4 border-[#111] z-20" />
                    </div>
                    
                    <div className="flex flex-col">
                      <h2 className="text-white font-extrabold text-xl tracking-tight mb-1">{listing.sellerName}</h2>
                      <div className="flex items-center gap-1.5 opacity-80">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-white font-black text-sm">{(listing.sellerRating || 5.0).toFixed(1)}</span>
                        <span className="text-gray-500 font-medium">|</span>
                        <span className="text-gray-400 font-medium text-sm">100% 正評</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Right Verified Badge */}
                  <div className="flex items-center gap-1 bg-blue-900/30 px-3 py-1.5 rounded-full border border-blue-800/50">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-tight">優質認證</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 py-4 border-y border-white/10 relative z-10">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-500 mb-1">成交量</span>
                    <span className="text-sm font-black text-white px-2">500+ 件</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-white/10">
                    <span className="text-xs font-bold text-gray-500 mb-1">回應速度</span>
                    <span className="text-sm font-black text-[#00d859]">極速</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-gray-500 mb-1">交收速度</span>
                    <span className="text-sm font-black text-white px-2">24小時內</span>
                  </div>
                </div>

                {/* Collapsible Reviews (Merged visually) */}
                <div className="pt-4 relative z-10">
                  <div 
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => setShowReviews(!showReviews)}
                  >
                    <h3 className="font-bold text-white flex items-center gap-2">
                      買家留言 <span className="px-2 py-0.5 bg-white/10 text-xs rounded-full text-gray-400">128</span>
                    </h3>
                    <button className="flex items-center gap-1 text-sm font-bold text-blue-400 group-active:opacity-50 transition-opacity">
                      展開
                      {showReviews ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {showReviews && (
                      <motion.div
                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                        animate={{ height: "auto", opacity: 1, marginTop: 20 }}
                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                        className="overflow-hidden space-y-4"
                      >
                        {/* Mock Review 1 */}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0 border border-blue-500/30">
                            T
                          </div>
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs font-bold text-white">Tommy Lee</span>
                              <span className="text-[10px] text-gray-500">2天前</span>
                            </div>
                            <p className="text-sm text-gray-300">
                              卡況超完美！包裝得很用心，防水防撞都做得很足，一定會回購的優質好賣家。
                            </p>
                          </div>
                        </div>
                        {/* Mock Review 2 */}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center font-bold text-purple-400 text-xs shrink-0 border border-purple-500/30">
                            P
                          </div>
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <span className="text-xs font-bold text-white">PikaMaster99</span>
                              <span className="text-[10px] text-gray-500">1週前</span>
                            </div>
                            <p className="text-sm text-gray-300">
                              交收速度真的極快，昨天晚上下單今天就面交了，交易愉快！
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Contact Bar - Apple Style */}
      <div className="fixed bottom-0 left-0 right-0 p-6 z-50">
        <div className="max-w-md mx-auto">
          <button 
            onClick={handleContactSeller}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-4 rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-6 h-6" />
            立即聯絡賣家
          </button>
        </div>
      </div>

      {/* Image Zoom Modal - Full Screen Immersive Experience */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center cursor-zoom-out"
          >
            <button 
              className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-[110]"
              onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
            >
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full h-full max-w-4xl mx-auto flex items-center justify-center p-4 sm:p-12 mb-safe pointer-events-none"
            >
              <div className="w-full h-full pointer-events-auto rounded-[2rem] overflow-hidden" onClick={e => e.stopPropagation()}>
                <ImageCarousel 
                  images={listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls : (listing.imageUrl ? [listing.imageUrl] : [])} 
                  title={listing.title} 
                  id={listing.id} 
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
