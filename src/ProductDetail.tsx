import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from './types';
import { 
  ArrowLeft, TrendingUp, ExternalLink, LineChart, Activity, ShoppingBag, 
  AlertCircle, BarChart3, ShieldCheck, Zap, Info, Maximize2, X, Share2, Heart 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHighResImage, handleImageError, getImageClass } from './lib/imageUtils';
import { FavoriteButton } from './components/FavoriteButton';
import { cleanMarketData } from './lib/priceUtils';
import { PriceTrend } from './components/PriceTrend';
import { CardReader } from './services/CardReader';

const SnkrdunkLogo = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-[4px] bg-gradient-to-br from-[#8C133E] via-[#35154E] to-[#070F35] flex flex-col items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] shrink-0 transition-all ${className}`}>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">SNKR</span>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">DUNK</span>
  </div>
);

export const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;

      try {
        const cardData = await CardReader.getCard(id);
        
        if (cardData) {
          const cleanedMarketData = cleanMarketData(cardData.id, cardData);
          setProduct({
            ...cardData,
            market_data: cleanedMarketData
          });
        } else {
          setError('找不到此卡片資料');
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        setError('載入失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#d4af37]"></div>
      </div>
    );
  }

  if (error || !product) {
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

  const changeStr = String(product.market_data.change_24h || '');
  const isPos = changeStr.startsWith('+');
  const isNeg = changeStr.startsWith('-');
  const changeColor = isPos ? 'text-[#30d158]' : isNeg ? 'text-[#ff453a]' : 'text-gray-400';
  const changeDisplay = changeStr.replace('+', '↗').replace('-', '↘') || '-';

  const investmentGrade = product.rank && product.rank <= 3 ? 'S' : product.rank && product.rank <= 10 ? 'A' : 'B';
  const volatility = isPos && parseFloat(product.market_data.change_24h) > 10 ? '高' : '中';
  const liquidity = product.rank && product.rank <= 10 ? '極高' : '高';
  
  const priceA = product.market_data.psa10_price || 0;
  const priceB = product.market_data.ebay_price || 0;
  const arbSpace = Math.abs(priceA - priceB);
  const arbPercent = priceA > 0 ? ((arbSpace / Math.min(priceA, priceB)) * 100).toFixed(1) : '0';

  const pokecaUrl = (product as any).pokeca_url || (product.data_source?.includes('pokeca-chart') ? product.data_source : null);
  const snkrdunkId = product.id?.startsWith('snkrdunk_') ? product.id.replace('snkrdunk_', '') : null;
  const snkrdunkUrl = snkrdunkId ? `https://snkrdunk.com/apparels/${snkrdunkId}` : null;
  
  const displaySourceUrl = pokecaUrl || snkrdunkUrl || product.data_source;
  const displaySourceName = displaySourceUrl?.includes('pokeca-chart') ? 'POKECA-CHART' : displaySourceUrl?.includes('snkrdunk') ? 'SNKRDUNK' : 'OFFICIAL';

  const getProductImage = () => {
    return getHighResImage(
      product.image_url || product.imageUrl || (product as any).imageURL,
      product.name_zh || product.name_jp,
      `${product.set_name}|${product.card_number}`,
      product.id || product.card_id
    ) || `https://placehold.co/600x840/111/d4af37?text=${encodeURIComponent(product.name_zh || 'Loading')}`;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white pb-32">
      <div className="max-w-6xl mx-auto pt-28 sm:pt-36 md:pt-44 md:px-12">
        <div className="bg-[#111] md:rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row">
          
          {/* Image Section */}
          <div 
            className="w-full md:w-[45%] aspect-[63/88] md:aspect-auto md:h-[700px] flex items-center justify-center bg-black/40 relative overflow-hidden cursor-zoom-in group/img"
            onClick={() => setIsZoomed(true)}
          >
            <img 
              src={getProductImage()} 
              alt={product.name_zh} 
              className={`${getImageClass(getProductImage())} w-full h-full md:h-full object-contain`}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e, product.image_url || product.imageUrl || (product as any).imageURL, product.name_zh, `${product.set_name}|${product.card_number}`)}
            />
            
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100 hidden md:flex">
               <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                 <Maximize2 className="w-8 h-8 text-white" />
               </div>
            </div>

            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (navigator.share) {
                  navigator.share({ title: product.name_zh, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                }
              }}
              className="absolute top-4 left-4 z-10 w-9 h-9 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all cursor-pointer md:hidden"
            >
              <Share2 className="w-4 h-4 opacity-90" />
            </button>

            <div className="absolute top-4 right-4 z-10 md:hidden">
              <div className="w-9 h-9 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all cursor-pointer">
                <FavoriteButton listingId={product.id} className="scale-100 !text-white opacity-90 !bg-transparent" />
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }}
              className="absolute bottom-4 right-4 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex mx-auto items-center justify-center text-white border border-white/10 active:scale-90 transition-all md:hidden"
            >
              <Maximize2 className="w-4 h-4 opacity-90" />
            </button>
          </div>

          {/* Details Section */}
          <div className="w-full md:w-[55%] p-5 sm:p-8 md:p-12 flex flex-col">
            <div className="mb-8">
              <div className="flex flex-nowrap items-center gap-1.5 sm:gap-3 mb-6 overflow-x-auto pb-2 scrollbar-none">
                <div className="px-2 sm:px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full flex items-center gap-1 sm:gap-1.5 shadow-lg shadow-amber-500/20 whitespace-nowrap shrink-0">
                  <Zap className="w-2.5 h-2.5 sm:w-3 h-3 text-white fill-white" />
                  <span className="text-[8px] sm:text-[10px] font-black text-white italic tracking-tighter uppercase">LEVEL {investmentGrade} ASSET</span>
                </div>
                
                <div className="px-2 sm:px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-1 sm:gap-2 whitespace-nowrap shrink-0">
                  <Activity className="w-2.5 h-2.5 sm:w-3 h-3 text-blue-400" />
                  <span className="text-[8px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">{liquidity} 流通性</span>
                </div>
                
                <div className="px-2 sm:px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-1 sm:gap-2 whitespace-nowrap shrink-0">
                  <LineChart className="w-2.5 h-2.5 sm:w-3 h-3 text-purple-400" />
                  <span className="text-[8px] sm:text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none">{volatility} 波動率</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2">
                {product.set_name && (
                  <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest leading-none">
                    {product.set_name} • {product.set_code || 'SV'} SERIES
                  </span>
                )}
                {product.card_number && (
                  <span className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded leading-none">
                    #{product.card_number}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl sm:text-6xl font-black text-white leading-[0.9] mb-2 tracking-tighter uppercase italic drop-shadow-sm break-words">
                {product.name_zh || product.name || 'Loading...'}
              </h1>
              <p className="text-base sm:text-xl text-gray-400 font-bold tracking-tight opacity-90">{product.name_hk || product.name_jp}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tighter italic">
                   市場數據動態 (MARKET DATA)
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Last Updated: {product.market_data?.last_updated ? new Date(product.market_data.last_updated).toLocaleString() : 'Just Now'}
                  </p>
                  {displaySourceUrl && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-blue-400 group/source hover:bg-white/10 transition-colors">
                      <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/source:opacity-100" />
                      <a href={displaySourceUrl} target="_blank" rel="noreferrer" className="hover:underline tracking-tight uppercase">
                        DATA SOURCE: {displaySourceName}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Advanced Investment Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="p-5 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col justify-between group hover:border-[#d4af37]/30 transition-all">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <SnkrdunkLogo className="w-4 h-4 sm:w-[18px] sm:h-[18px] grayscale group-hover:grayscale-0 opacity-80 group-hover:opacity-100" />
                    <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest leading-none whitespace-nowrap">PSA10 平台售價</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-[#d4af37] tracking-tighter block mt-2 drop-shadow-sm">
                    HK${(product.market_data?.psa10_price || product.market_data?.snkrdunk_price || product.market_data?.ebay_price || 0).toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> 認證資產
                </div>
              </div>
              
              <div className="p-5 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col justify-between group hover:border-white/20 transition-all">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <SnkrdunkLogo className="w-4 h-4 sm:w-[18px] sm:h-[18px] grayscale group-hover:grayscale-0 opacity-80 group-hover:opacity-100" />
                    <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest leading-none">RAW 裸卡價格</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter block mt-2 drop-shadow-sm">
                    HK${(product.market_data?.raw_price || 0) > 0 ? (product.market_data?.raw_price || 0).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-gray-500">
                  <LineChart className="w-3.5 h-3.5 text-gray-400" /> 未鑑定市價
                </div>
              </div>
            </div>

            {/* Market Statistics Grid (HKD Corrected) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">平均成交價</span>
                <span className="text-sm sm:text-lg font-black text-white tracking-tighter">
                  HK${Math.round(((product.market_data as any)?.avg_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-green-500/70 uppercase tracking-widest mb-1.5">歷史最高價</span>
                <span className="text-sm sm:text-lg font-black text-[#30d158] tracking-tighter">
                  HK${Math.round(((product.market_data as any)?.max_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-red-500/70 uppercase tracking-widest mb-1.5">市場最低價</span>
                <span className="text-sm sm:text-lg font-black text-[#ff453a] tracking-tighter">
                  HK${Math.round(((product.market_data as any)?.min_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
            </div>

            {/* PSA Population Data Report */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-white/20 transition-all overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 whitespace-nowrap">鑑定總數</span>
                <span className="text-base sm:text-xl font-black text-white tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_total || (product as any).psa_pop_total;
                    return (val !== undefined && val !== null && Number(val) > 0) ? Number(val).toLocaleString() : '-';
                  })()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-[#d4af37]/30 transition-all border-l border-r border-white/10 overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 font-sans whitespace-nowrap">PSA 10 數量</span>
                <span className="text-base sm:text-xl font-black text-[#d4af37] tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_10 || (product as any).psa_pop_10 || product.market_data?.psa10_population || (product as any).psa10_population;
                    return (val !== undefined && val !== null && Number(val) > 0) ? Number(val).toLocaleString() : '-';
                  })()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-purple-500/30 transition-all overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 whitespace-nowrap">PSA 10 比例</span>
                <span className="text-base sm:text-xl font-black text-purple-400 tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_10_percent || (product as any).psa_pop_10_percent;
                    return (val && val !== '0%') ? val : '-';
                  })()}
                </span>
              </div>
            </div>

            {/* Price Trend Chart */}
            <div className="mb-8">
              <PriceTrend productId={product.card_id || product.id || id || ''} collectionName={product.collection_name || 'products'} />
            </div>

            {/* Investment Potential Summary */}
            <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> 投資潛力分析
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>增值潛力</span>
                    <span className="text-white">{product.investment_metrics?.growth_potential ? (product.investment_metrics.growth_potential >= 80 ? '極強' : '穩健') : (product.rank && product.rank <= 5 ? '極強' : '穩健')}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${product.investment_metrics?.growth_potential || (100 - ((product.rank || 0)) * 5)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>持有建議</span>
                    <span className="text-white">{product.investment_metrics?.holding_advice || '長期 (2-3年)'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4af37] rounded-full" style={{ width: `${product.investment_metrics?.holding_score || 85}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>市場流通性</span>
                    <span className="text-white">{liquidity}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: liquidity === '極高' ? '95%' : '80%' }} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-bold italic mt-4 border-l-2 border-[#d4af37]/30 pl-3">
                  {product.analysis_quote ? (
                    `「${product.analysis_quote}」`
                  ) : (
                    `「${product.name_zh} 作為 ${product.set_name} 的明星卡牌，其藝術價值與稀有度確保了強大的市場深度與長期升值空間。」`
                  )}
                </p>
              </div>
            </div>

            {/* Extended Details */}
            {(product as any).description && (
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 mb-6">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">卡片描述</h4>
                <p className="text-sm text-gray-300 leading-relaxed font-medium">{(product as any).description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {(['rarity_zh', 'type', 'illustrator', 'weakness'] as const).map((key) => {
                const val = (product as any)[key];
                if (!val) return null;
                const labels: Record<string, string> = { rarity_zh: '稀有度', type: '類型', illustrator: '繪師', weakness: '弱點' };
                return (
                  <div key={key} className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="block text-[10px] font-black text-gray-500 uppercase mb-1">{labels[key]}</span>
                    <span className="text-sm font-bold text-gray-200">{val}</span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-8 border-t border-white/10">
              <button 
                onClick={() => navigate(`/?search=${encodeURIComponent(product.name_zh || '')}`)}
                className="w-full bg-white hover:bg-gray-200 text-black py-4 sm:py-5 rounded-[1.25rem] sm:rounded-[1.5rem] font-black text-lg sm:text-xl flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 shadow-lg shadow-white/5">
                <ShoppingBag className="w-6 h-6" />
                在市集尋找此卡
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out">
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
              src={getProductImage()}
              alt={product.name_zh}
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
