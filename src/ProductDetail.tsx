import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink, Maximize2, X, Share2, RefreshCw, Zap, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CardReader } from './lib/services/cardReader';
import { PokecaGoldCard, getSnkrdunkImageUrl } from './types/card';

/**
 * ProductDetail - Card Detail Page
 * 
 * Dark Theme Bento Grid Layout
 * Data Source: CardReader (pokeca_gold collection + pokeca-chart API)
 */

const SnkrdunkLogo = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-[4px] bg-gradient-to-br from-[#8C133E] via-[#35154E] to-[#070F35] flex flex-col items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] shrink-0 transition-all ${className}`}>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">SNKR</span>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">DUNK</span>
  </div>
);

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-[#000000] pt-28 px-6">
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 md:row-span-4 bg-[#1c1c1e] rounded-[2rem] h-[600px]" />
        <div className="md:col-span-2 bg-[#1c1c1e] rounded-[2rem] h-[180px]" />
        <div className="md:col-span-2 bg-[#1c1c1e] rounded-[2rem] h-[180px]" />
        <div className="bg-[#1c1c1e] rounded-[2rem] h-[180px]" />
        <div className="bg-[#1c1c1e] rounded-[2rem] h-[180px]" />
      </div>
    </div>
  </div>
);

// Bento card component
const BentoCard = ({ 
  children, 
  className = '', 
  hover = true 
}: { 
  children: React.ReactNode; 
  className?: string; 
  hover?: boolean;
}) => (
  <div className={`
    bg-[#1c1c1e] rounded-[2rem] p-6 
    border border-white/5 
    ${hover ? 'hover:border-white/20 hover:shadow-lg hover:shadow-black/20' : ''}
    transition-all duration-300
    ${className}
  `}>
    {children}
  </div>
);

// Large stat display
const StatBlock = ({ 
  label, 
  value, 
  subtext, 
  valueColor = 'text-white',
  className = ''
}: {
  label: string;
  value: string | number;
  subtext?: string;
  valueColor?: string;
  className?: string;
}) => (
  <div className={className}>
    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{label}</span>
    <span className={`text-3xl font-black tracking-tighter block mt-2 ${valueColor}`}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
    {subtext && <span className="text-[11px] text-gray-500 mt-1 block">{subtext}</span>}
  </div>
);

export const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [card, setCard] = useState<PokecaGoldCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch card data using CardReader
  useEffect(() => {
    const fetchCard = async () => {
      if (!id) return;

      try {
        // Try pokeca_gold first (SNKRDUNK ID as doc ID)
        const result = await CardReader.getCardWithFreshness(id);
        
        if (result) {
          setCard(result.card);
          // If data was stale, trigger refresh indicator
          if (result.isStale) {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 3000);
          }
        } else {
          // Fallback: try leaderboard collection (for rank_XX doc IDs)
          const leaderboardSnap = await getDoc(doc(db, 'leaderboard', id));
          if (leaderboardSnap.exists()) {
            const data = leaderboardSnap.data();
            // Build a PokecaGoldCard-compatible object from leaderboard data
            const fallbackCard: PokecaGoldCard = {
              id: id,
              snkrdunk_id: data.snkrdunk_id || id,
              name_jp: data.name_jp || data.name_zh || 'Unknown',
              name_en: data.name_en || '',
              name_zh: data.name_zh || data.name_jp || '',
              card_number: data.card_number || '',
              set_code: data.set_code || '',
              set_name: data.set_name || '',
              image_url: data.image_url || '',
              market_data: data.market_data || {},
              psa_data: data.psa_data || {},
              updatedAt: data.updatedAt,
            };
            setCard(fallbackCard);
          } else {
            setError('找不到此卡片資料');
          }
        }
      } catch (err) {
        console.error("Error fetching card:", err);
        setError('載入失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, [id]);

  // Manual refresh
  const handleRefresh = async () => {
    if (!id) return;
    setIsRefreshing(true);
    try {
      // If card came from leaderboard fallback, it may not have slug for CardReader
      if (card?.snkrdunk_id && card?.slug) {
        await CardReader.triggerDataRefresh(id);
        const result = await CardReader.getCard(id);
        if (result) setCard(result);
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (error || !card) {
    return (
      <div className="min-h-screen pt-20 flex flex-col items-center justify-center px-4 text-center bg-[#0a0a0a]">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">{error || '找不到此卡片'}</h2>
        <button 
          onClick={() => navigate(-1)}
          className="mt-6 px-6 py-2 bg-[#1c1c1e] border border-white/10 text-white rounded-xl font-bold hover:bg-white/5 transition-colors"
        >
          返回上一頁
        </button>
      </div>
    );
  }

  // Derive values
  const imageUrl = card.image_url || getSnkrdunkImageUrl(card.id);
  const psa10 = card.psa_data?.psa10 || 0;
  const psaAll = card.psa_data?.psa_all || 0;
  const psa10Pct = card.psa_data?.psa10_pct || 0;
  const priceJpy = card.market_data?.psa10_latest_jpy || card.market_data?.psa10_median || 0;
  const priceHkd = card.market_data?.psa10_price || 0;
  const rawPriceHkd = card.market_data?.raw_price || card.market_data?.raw_hkd_lowest || 0;

  return (
    <div className="min-h-screen bg-[#000000] text-white pb-32">
      <div className="max-w-6xl mx-auto pt-28 sm:pt-36 md:pt-44 md:px-12">
        
        {/* Header Row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                {card.set_code?.toUpperCase()} · #{card.card_number}
              </span>
              {card.slug && (
                <a 
                  href={`https://pokeca-chart.com/${card.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[9px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  pokeca-chart
                </a>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase leading-[0.9]">
              {card.name_jp}
            </h1>
            {card.name_en && card.name_en !== card.name_jp && (
              <p className="text-sm text-gray-400 mt-1">{card.name_en}</p>
            )}
          </div>
          
          {/* Refresh indicator */}
          <AnimatePresence>
            {isRefreshing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span className="text-[10px] font-bold text-blue-400">更新中</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 auto-rows-[180px]">
          
          {/* 1. Hero Image (2 cols x 4 rows) */}
          <div 
            className="col-span-2 md:col-span-3 row-span-4 bg-black/40 rounded-[2rem] overflow-hidden relative group cursor-zoom-in"
            onClick={() => setIsZoomed(true)}
          >
            <img 
              src={imageUrl}
              alt={card.name_jp}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getSnkrdunkImageUrl(card.id);
              }}
            />
            
            {/* Zoom hint overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all hidden md:flex items-center justify-center">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-full items-center justify-center border border-white/20 opacity-0 group-hover:opacity-100 transition-all flex">
                <Maximize2 className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Mobile zoom button */}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }}
              className="absolute bottom-4 right-4 z-10 w-9 h-9 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 md:hidden"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* 2. PSA 10 Population - HIGHLIGHT */}
          <div className="col-span-2 md:col-span-2 row-span-1 bg-gradient-to-br from-[#d4af37]/20 to-[#d4af37]/5 border border-[#d4af37]/30 rounded-[2rem] p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#d4af37]" />
              <span className="text-[10px] font-black text-[#d4af37] uppercase tracking-widest">PSA 10 Population</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-[#d4af37] tracking-tighter">
                {psa10 > 0 ? psa10.toLocaleString() : '--'}
              </span>
              <span className="text-xs text-gray-400">units</span>
            </div>
            <div className="text-[10px] text-gray-500">
              Total graded: <span className="text-gray-300">{psaAll > 0 ? psaAll.toLocaleString() : '--'}</span>
            </div>
          </div>

          {/* 3. PSA 10 Rate */}
          <div className="col-span-1 md:col-span-1 row-span-1 bg-[#1c1c1e] border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gem Mint Rate</span>
            <span className="text-3xl font-black tracking-tighter text-purple-400">
              {psa10Pct > 0 ? `${psa10Pct}%` : '--'}
            </span>
            {psa10Pct > 0 && (
              <div className="w-full bg-gray-800 rounded-full h-1 mt-2 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(psa10Pct, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* 4. Market Price JPY */}
          <div className="col-span-1 md:col-span-1 row-span-1 bg-[#1c1c1e] border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Market (JPY)</span>
            <span className="text-2xl font-black tracking-tighter text-white">
              {priceJpy > 0 ? `¥${priceJpy.toLocaleString()}` : '--'}
            </span>
            {card.market_data?.source && (
              <span className="text-[9px] text-gray-500">{card.market_data.source}</span>
            )}
          </div>

          {/* 5. PSA10 HKD Price */}
          <div className="col-span-2 md:col-span-2 row-span-1 bg-[#1c1c1e] border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <SnkrdunkLogo className="w-5 h-5 opacity-60" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">PSA10 (HKD)</span>
            </div>
            <span className="text-3xl font-black tracking-tighter text-[#d4af37]">
              {priceHkd > 0 ? `HK$${priceHkd.toLocaleString()}` : '--'}
            </span>
          </div>

          {/* 6. RAW Price */}
          <div className="col-span-1 md:col-span-1 row-span-1 bg-[#1c1c1e] border border-white/5 rounded-[2rem] p-5 flex flex-col justify-between">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">RAW (HKD)</span>
            <span className="text-2xl font-black tracking-tighter text-white">
              {rawPriceHkd > 0 ? `HK$${rawPriceHkd.toLocaleString()}` : '--'}
            </span>
          </div>

          {/* 7. Set Info */}
          <div className="col-span-2 md:col-span-5 row-span-1 bg-[#1c1c1e] border border-white/5 rounded-[2rem] p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-lg font-black text-gray-400">{card.set_code?.toUpperCase().slice(0, 3)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-widest">Set Code</span>
                <p className="text-lg font-black text-white">{card.set_code?.toUpperCase()}</p>
              </div>
              <div className="border-l border-white/10 h-10 mx-2" />
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-widest">Card No.</span>
                <p className="text-lg font-black text-white">#{card.card_number}</p>
              </div>
            </div>
            
            {/* SNKRDUNK Link */}
            <a 
              href={`https://snkrdunk.com/apparels/${card.snkrdunk_id || card.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <SnkrdunkLogo className="w-4 h-4" />
              <span className="text-[11px] font-bold text-gray-300">View on SNKRDUNK</span>
              <ExternalLink className="w-3 h-3 text-gray-500" />
            </a>
          </div>

        </div>

        {/* Manual Refresh Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1c1c1e] border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '更新中...' : '刷新數據'}
          </button>
        </div>

        {/* Info note */}
        <p className="text-center text-[10px] text-gray-600 mt-4">
          數據自動從 pokeca-chart.com 更新 · 使用 SNKRDUNK ID: {card.id}
        </p>
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
          >
            <button 
              className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-[110]"
              onClick={() => setIsZoomed(false)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={imageUrl}
              alt={card.name_jp}
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};