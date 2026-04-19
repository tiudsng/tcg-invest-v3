import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Product } from './types';
import { db } from './firebase';
import { 
  ArrowLeft, TrendingUp, ExternalLink, LineChart, Activity, ShoppingBag, 
  AlertCircle, BarChart3, ShieldCheck, Zap, Info, Maximize2, X, Share2, Heart 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getHighResImage, handleImageError, getImageClass } from './lib/imageUtils';
import { FavoriteButton } from './components/FavoriteButton';

const SnkrdunkLogo = ({ className = "" }: { className?: string }) => (
  <div className={`rounded-[4px] bg-gradient-to-br from-[#8C133E] via-[#35154E] to-[#070F35] flex flex-col items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] shrink-0 transition-all ${className}`}>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">SNKR</span>
    <span className="text-[0.275rem] font-black leading-[0.85] tracking-tighter text-white">DUNK</span>
  </div>
);

// Fallback mock data in case the ID is from the mock list
const MOCK_PRODUCTS: Record<string, Product> = {
  'van_gogh_pikachu': {
    id: 'van_gogh_pikachu',
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
      ebay_price: 28000, 
      psa10_price: 26743,
      raw_price: 6160,
      change_24h: '+5.1%', 
      status: 'up' 
    }
  },
  'charizard_151_sar': {
    id: 'charizard_151_sar',
    card_id: 'charizard_151_sar',
    rank: 1,
    name_zh: '噴火龍 ex (151 SAR)',
    name_jp: 'リザードンex',
    card_number: '201/165',
    set_name: 'SV2a 151',
    image_url: 'https://images.pokemoncard.io/cards/sv2a/201.png',
    market_data: { snkrdunk_price: 12800, ebay_price: 13500, change_24h: '+2.4%', status: 'up' }
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
  },
  'override_pikachu_ex_ur': {
    id: 'override_pikachu_ex_ur',
    card_id: 'pikachu_ex_sv8a',
    rank: 8,
    name_zh: '皮卡丘 ex (超電突波 UR)',
    name_jp: 'ピカチュウex',
    card_number: '236/187',
    set_name: 'SV8a',
    image_url: 'https://den-cards.pokellector.com/406/Pikachu-ex.SV8A.236.55302.png',
    market_data: { snkrdunk_price: 3200, ebay_price: 5100, change_24h: '+2.1%', status: 'up' }
  },
  'mock1': {
    id: 'mock1',
    card_id: 'c1',
    rank: 1,
    name_zh: 'LUGIA VSTAR (HOLO)',
    name_jp: 'ルギアVSTAR',
    card_number: '196',
    set_name: 'SILVER TEMPEST',
    image_url: 'https://placehold.co/600x840/111111/d4af37?text=Lugia+VSTAR',
    market_data: { snkrdunk_price: 10828, ebay_price: 10828, change_24h: '+15.4%', status: 'up' }
  },
  'mock2': {
    id: 'mock2',
    card_id: 'c2',
    rank: 2,
    name_zh: 'Giratina V SA',
    name_jp: 'ギラティナV',
    set_name: 'LOST ABYSS',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Giratina+V',
    market_data: { snkrdunk_price: 7950, ebay_price: 7950, change_24h: '+3.7%', status: 'up' }
  },
  'mock3': {
    id: 'mock3',
    card_id: 'c3',
    rank: 3,
    name_zh: 'Umbreon VMAX SA',
    name_jp: 'ブラッキーVMAX',
    set_name: 'EEVEE HEROES',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Umbreon+VMAX',
    market_data: { snkrdunk_price: 4110, ebay_price: 4110, change_24h: '-1.2%', status: 'down' }
  },
  'mock4': {
    id: 'mock4',
    card_id: 'c4',
    rank: 4,
    name_zh: 'Charizard VMAX',
    name_jp: 'リザードンVMAX',
    set_name: 'SHINING FATES',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Charizard',
    market_data: { snkrdunk_price: 2150, ebay_price: 2150, change_24h: '+1.5%', status: 'up' }
  }
};

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
      
      // Check if it's a mock product first
      if (MOCK_PRODUCTS[id]) {
        setProduct(MOCK_PRODUCTS[id]);
        setLoading(false);
        return;
      }

      try {
        let cardData: any = null;
        let docSnap = await getDoc(doc(db, 'list_1', id));
        
        if (docSnap.exists()) {
          cardData = docSnap.data();
        } else {
          // Try legacy products collection
          docSnap = await getDoc(doc(db, 'products', id));
          if (docSnap.exists()) {
            cardData = docSnap.data();
          }
        }
        
        if (cardData) {
          const marketData = (cardData.market_data || {}) as any;
          
          let snkrdunkPrice = cardData.psa10_hkd || marketData.snkrdunk_price || marketData.snkdunk_price || cardData.snkrdunk_price || cardData.price || 0;
          let ebayPrice = marketData.ebay_price || cardData.ebay_price || cardData.price || 0;
          let psa10Price = marketData.psa10_price || 0;
          let rawPrice = marketData.raw_price || 0;

          // Check for and auto-fix the JPY -> HKD erroneous unmapped prices from raw DB imports
          // Specifically fixing the SNKRDUNK exact value for Charizard ex SAR 151
          if (docSnap.id === 'ion_sar' || cardData.name_zh?.includes('噴火龍 ex SAR')) {
            if (ebayPrice > 10000) {
              // converting 18900 JPY to exact HKD (approx ~964)
              ebayPrice = Math.round(ebayPrice * 0.051);
              if (snkrdunkPrice > 10000) snkrdunkPrice = Math.round(snkrdunkPrice * 0.051);
            }
          }

          setProduct({
            id: docSnap.id,
            ...cardData,
            card_id: cardData.card_id || docSnap.id,
            market_data: {
              snkrdunk_price: snkrdunkPrice,
              ebay_price: ebayPrice,
              psa10_price: psa10Price,
              raw_price: rawPrice,
              change_24h: marketData.change_24h || cardData.change_24h || '0%',
              status: marketData.status || cardData.status || 'stable'
            }
          } as Product);
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

  const isPos = product.market_data.change_24h?.startsWith('+');
  const isNeg = product.market_data.change_24h?.startsWith('-');
  const changeColor = isPos ? 'text-[#30d158]' : isNeg ? 'text-[#ff453a]' : 'text-gray-400';
  const changeDisplay = product.market_data.change_24h?.replace('+', '↗').replace('-', '↘') || '-';

  // Investment Metrics Logic (Simulated based on rank/change)
  const investmentGrade = product.rank <= 3 ? 'S' : product.rank <= 10 ? 'A' : 'B';
  const volatility = isPos && parseFloat(product.market_data.change_24h) > 10 ? '高' : '中';
  const liquidity = product.rank <= 10 ? '極高' : '高';
  
  // Platform Arbitrage
  const priceA = product.market_data.snkrdunk_price || 0;
  const priceB = product.market_data.ebay_price || 0;
  const arbSpace = Math.abs(priceA - priceB);
  const arbPercent = priceA > 0 ? ((arbSpace / Math.min(priceA, priceB)) * 100).toFixed(1) : '0';

  const getProductImage = () => {
    return getHighResImage(
      product.image_url || product.imageUrl || (product as any).imageURL,
      product.name_zh || product.name_jp,
      `${product.set_name}|${product.card_number}`
    ) || `https://placehold.co/600x840/111/d4af37?text=${encodeURIComponent(product.name_zh)}`;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white pb-32">
      <div className="max-w-6xl mx-auto pt-28 sm:pt-36 md:pt-44 md:px-12">
        <div className="bg-[#111] md:rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row">
          
          {/* Image Section */}
          <div 
            className="w-full md:w-[55%] aspect-[3/4] md:aspect-auto md:min-h-[700px] bg-black relative flex items-center justify-center p-0 md:p-12 overflow-hidden cursor-zoom-in group/img"
            onClick={() => setIsZoomed(true)}
          >
            <img 
              src={getProductImage()} 
              alt={product.name_zh} 
              className={getImageClass(getProductImage())}
              referrerPolicy="no-referrer"
              onError={(e) => handleImageError(e, product.image_url || product.imageUrl || (product as any).imageURL, product.name_zh)}
            />
            
            {/* Desktop Zoom Button hint */}
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100 hidden md:flex">
               <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                 <Maximize2 className="w-8 h-8 text-white" />
               </div>
            </div>

            {/* Share - Minimal Obstruct Top Left */}
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (navigator.share) {
                  navigator.share({ title: product.name_zh, url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  // Assuming toast is available globally or we can just rely on the action
                }
              }}
              className="absolute top-4 left-4 z-10 w-9 h-9 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all cursor-pointer md:hidden"
            >
              <Share2 className="w-4 h-4 opacity-90" />
            </button>

            {/* Favorite - Minimal Obstruct Top Right */}
            <div className="absolute top-4 right-4 z-10 md:hidden">
              <div className="w-9 h-9 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all cursor-pointer">
                <FavoriteButton listingId={product.id} className="scale-100 !text-white opacity-90 !bg-transparent" />
              </div>
            </div>

            {/* Zoom - Minimal Obstruct Bottom Right */}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }}
              className="absolute bottom-4 right-4 z-10 w-8 h-8 bg-black/50 backdrop-blur-md rounded-full flex mx-auto items-center justify-center text-white border border-white/10 active:scale-90 transition-all md:hidden"
            >
              <Maximize2 className="w-4 h-4 opacity-90" />
            </button>
          </div>

          {/* Details Section */}
          <div className="w-full md:w-[45%] p-5 sm:p-8 md:p-12 flex flex-col">
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6">
                {/* Investment Grade Badge */}
                <div className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
                  <Zap className="w-3 h-3 text-white fill-white" />
                  <span className="text-[10px] font-black text-white italic tracking-tighter">LEVEL {investmentGrade} ASSET</span>
                </div>
                
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{liquidity} 流通性</span>
                </div>

                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                  <LineChart className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{volatility} 波動率</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-4">
                {product.set_name && (
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    {product.set_name} • SV SERIES
                  </span>
                )}
                {product.card_number && (
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded">
                    #{product.card_number}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl sm:text-6xl font-black text-white leading-[0.9] mb-4 tracking-tighter uppercase italic drop-shadow-sm">
                {product.name_zh}
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 font-bold tracking-tight opacity-80">{product.name_jp}</p>
            </div>

            {/* Advanced Investment Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="p-5 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col justify-between group hover:border-[#d4af37]/30 transition-all">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <SnkrdunkLogo className="w-4 h-4 sm:w-[18px] sm:h-[18px] grayscale group-hover:grayscale-0 opacity-80 group-hover:opacity-100" />
                    <span className="text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-widest leading-none">鑑定估算 (PSA 10)</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-[#d4af37] tracking-tighter block mt-2 drop-shadow-sm">
                    HK${(product.market_data?.psa10_price || product.market_data?.snkrdunk_price || 0).toLocaleString()}
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

            {/* Main Market Pulse */}
            <div className="p-6 sm:p-8 bg-gradient-to-br from-[#1c1c1e] to-[#111] rounded-[2rem] border border-[#d4af37]/20 mb-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Activity className="w-32 h-32 text-[#d4af37]" />
              </div>
              
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2 text-[#d4af37]">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">當前市場成交價中心</span>
                </div>
                <span className={`text-base font-black ${changeColor} bg-black/40 px-3 py-1 rounded-full border border-current opacity-80`}>
                  {changeDisplay}
                </span>
              </div>

              <div className="relative z-10 mb-6 font-mono">
                <span className="text-4xl sm:text-7xl font-black text-white tracking-tighter flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl text-gray-500">$</span>
                  {(product.market_data?.ebay_price || product.market_data?.snkrdunk_price || 0).toLocaleString()}
                </span>
              </div>

              {/* Simulated Micro Chart */}
              <div className="relative h-16 w-full flex items-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                {[40, 65, 45, 80, 55, 90, 75, 100, 85, 110].map((h, i) => (
                  <div 
                    key={i} 
                    className={`flex-1 rounded-t-sm transition-all duration-700 ${isPos ? 'bg-[#30d158]' : 'bg-[#ff453a]'}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
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
                    <span className="text-white">{product.rank <= 5 ? '極強' : '穏健'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${100 - (product.rank || 0) * 5}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>持有建議</span>
                    <span className="text-white">長期 (2-3年)</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4af37] rounded-full" style={{ width: '85%' }} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-bold italic mt-4 border-l-2 border-[#d4af37]/30 pl-3">
                  「{product.name_zh} 作為 {product.set_name} 的明星卡牌，其藝術價值與稀有度確保了強大的市場深度與長期升值空間。」
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
                onClick={() => navigate(`/?search=${encodeURIComponent(product.name_zh)}`)}
                className="w-full bg-white hover:bg-gray-200 text-black py-4 sm:py-5 rounded-[1.25rem] sm:rounded-[1.5rem] font-black text-lg sm:text-xl flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 shadow-lg shadow-white/5"
              >
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
