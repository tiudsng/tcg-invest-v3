import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Listing } from './types';
import { useAuth } from './AuthContext';
import { ArrowLeft, MessageCircle, ShieldCheck, Star, Clock, Share2, AlertCircle } from 'lucide-react';
import { ConditionBadge } from './components/ConditionBadge';
import { FavoriteButton } from './components/FavoriteButton';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-32">
      {/* Mobile Header (Transparent/Glass) */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-black/20 dark:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-black/40 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-2 pointer-events-auto">
          <button className="w-10 h-10 bg-black/20 dark:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/40 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-black/20 dark:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center pointer-events-auto">
            <FavoriteButton listingId={listing.id} className="!text-white" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto md:pt-32 md:px-12">
        <div className="bg-white dark:bg-[#111] md:rounded-[3rem] shadow-2xl border-x border-b md:border border-gray-100 dark:border-white/5 overflow-hidden flex flex-col md:flex-row">
          
          {/* Image Section */}
          <div className="w-full md:w-[55%] aspect-[3/4] md:aspect-auto md:min-h-[700px] bg-gray-100 dark:bg-black relative">
            <img 
              src={listing.imageUrl} 
              alt={listing.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${listing.id}/800/1000`;
              }}
            />
            <div className="absolute bottom-8 left-8">
              <ConditionBadge condition={listing.condition} cardType={listing.cardType} title={listing.title} className="shadow-2xl !h-12 !px-6 !text-lg" />
            </div>
          </div>

          {/* Details Section */}
          <div className="w-full md:w-[45%] p-8 sm:p-12 flex flex-col">
            <div className="mb-10">
              <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-4 tracking-tight">
                {listing.title}
              </h1>
              {listing.englishName && (
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-6 font-medium">{listing.englishName}</p>
              )}
              
              <div className="flex items-baseline gap-3 mt-8">
                <span className="text-5xl sm:text-7xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                  HK${(listing.price * 7.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            <div className="space-y-10 flex-grow">
              {/* Seller Info */}
              <div className="p-6 bg-gray-50 dark:bg-[#1a1a1a] rounded-[2rem] border border-gray-100 dark:border-white/5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  {listing.sellerPhoto ? (
                    <img src={listing.sellerPhoto} alt={listing.sellerName} className="w-16 h-16 rounded-full border-2 border-white dark:border-gray-800 shadow-md" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800">
                      <span className="text-blue-600 dark:text-blue-400 font-bold text-2xl">
                        {listing.sellerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-gray-900 dark:text-white tracking-tight">{listing.sellerName}</span>
                      <ShieldCheck className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex items-center gap-2 text-base text-gray-500 mt-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-black text-gray-700 dark:text-gray-300">{(listing.sellerRating || 5.0).toFixed(1)}</span>
                      <span className="mx-1 opacity-30">·</span>
                      <span className="font-bold">100% 好評</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">商品描述</h3>
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-base sm:text-lg">
                  {listing.description || '賣家未提供詳細描述。'}
                </div>
              </div>

              {/* Meta Info */}
              <div className="pt-8 border-t border-gray-100 dark:border-white/5 grid grid-cols-2 gap-8 text-base">
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase tracking-widest text-xs">上架時間</span>
                  <span className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    {listing.createdAt ? new Date(listing.createdAt.toDate()).toLocaleDateString() : '未知'}
                  </span>
                </div>
                <div>
                  <span className="block text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase tracking-widest text-xs">商品狀態</span>
                  <span className="font-black text-green-600 dark:text-green-400 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    可交易
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-12 pt-8 border-t border-gray-100 dark:border-white/5 flex gap-4">
              <button 
                onClick={handleContactSeller}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/30 active:scale-95"
              >
                <MessageCircle className="w-6 h-6" />
                聯絡賣家
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
