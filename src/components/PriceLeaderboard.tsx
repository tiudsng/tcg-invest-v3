import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { getHighResImage, handleImageError, getImageClass } from '../lib/imageUtils';
import { cleanMarketData } from '../lib/priceUtils';

const AnimatedPrice = ({ price, prefix = "HK$ ", className = "" }: { price: number, prefix?: string, className?: string }) => {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (prevPriceRef.current !== undefined && prevPriceRef.current !== price) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 1000);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <span className={`${isFlashing ? 'price-flash' : ''} ${className}`}>
      {prefix}{price.toLocaleString()}
    </span>
  );
};

const renderChange = (change: string, append7D: boolean = false) => {
  if (!change) return <span className="text-gray-400">-</span>;
  const isPos = change.startsWith('+');
  const isNeg = change.startsWith('-');
  const color = isPos ? 'text-[#30d158]' : isNeg ? 'text-[#ff453a]' : 'text-gray-400';
  const display = change.replace('+', '↗').replace('-', '↘');
  return (
    <span className={color}>
      {display}{append7D ? ' (7D)' : ''}
    </span>
  );
};

const MOCK_PRODUCTS: Product[] = [
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
    image_url: 'https://den-cards.pokellector.com/371/Mew-ex.SV2A.205.48354.png',
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

export const PriceLeaderboard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Reading from 'list_1' as requested, which contains the curated leaderboard data
    const q = query(
      collection(db, 'list_1'),
      orderBy('rank', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const marketData = cleanMarketData(doc.id, data);

        return {
          id: doc.id,
          ...data,
          market_data: marketData
        };
      }) as any[];
      
      // Fallback to mock data if collection is empty
      if (productsData.length === 0) {
        setProducts(MOCK_PRODUCTS);
      } else {
        setProducts(productsData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard from list_1:", error);
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl py-12 flex flex-col justify-center items-center h-64 border border-gray-100 dark:border-white/5 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#d4af37] mb-4"></div>
        <p className="text-[#d4af37] text-sm font-medium">載入排行榜中...</p>
      </div>
    );
  }

  const topCards = products.slice(0, 3);
  const remainingCards = products.slice(3);

  return (
    <div className="mb-12 sm:mb-16 bg-[#0a0a0a] rounded-[2rem] p-4 sm:p-6 shadow-2xl overflow-hidden border border-white/5">
      <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* NO.1 Card */}
        {topCards[0] && (
          <div 
            onClick={() => navigate(`/product/${topCards[0].id || topCards[0].card_id}`)}
            className="col-span-2 lg:col-span-1 relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-[#d4af37]/60 bg-black flex flex-col shadow-[0_0_20px_rgba(212,175,55,0.15)] cursor-pointer hover:scale-[1.01] transition-transform duration-300"
          >
            {/* Image Section - Matches exact card aspect ratio (63/88) so the whole card fits */}
            <div className="relative w-full aspect-[63/88] bg-black">
              <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-20 text-[#d4af37] text-4xl sm:text-5xl font-black drop-shadow-[0_4px_4px_rgba(0,0,0,1)] tracking-tighter italic">NO.1</div>
                <img 
                  src={getHighResImage(topCards[0].image_url || (topCards[0] as any).imageUrl || (topCards[0] as any).imageURL, topCards[0].name_zh, `${topCards[0].set_name}|${topCards[0].card_number}`)} 
                  alt={topCards[0].name_zh} 
                  className={getImageClass(getHighResImage(topCards[0].image_url || (topCards[0] as any).imageUrl || (topCards[0] as any).imageURL, topCards[0].name_zh, `${topCards[0].set_name}|${topCards[0].card_number}`))}
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, topCards[0].image_url || (topCards[0] as any).imageUrl || (topCards[0] as any).imageURL, topCards[0].name_zh)}
                />
              {/* Overlay Gradient to blend to black smoothly without hiding the card's bottom arts completely */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent opacity-90"></div>
            </div>
            
            {/* Info Section - Solid Black Background flush with gradient */}
            <div className="px-5 pb-5 pt-0 relative z-10 bg-black flex flex-col">
              <div className="flex justify-between items-center gap-3 mb-2">
                <h3 className="text-white font-bold text-base sm:text-xl uppercase leading-tight line-clamp-2 italic tracking-tight">
                  {topCards[0].name_zh} {topCards[0].set_name ? `- ${topCards[0].set_name}` : ''} {topCards[0].card_number ? `#${topCards[0].card_number}` : ''}
                </h3>
              </div>
              
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex items-end gap-3 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#d4af37] uppercase tracking-wider mb-0.5">PSA10 snkrdunk 售價</span>
                    <span className="text-[#d4af37] text-2xl sm:text-4xl font-black tracking-tighter leading-none">
                      <AnimatedPrice price={topCards[0].market_data?.ebay_price || topCards[0].market_data?.snkrdunk_price || 0} />
                    </span>
                  </div>
                  <div className="pb-1">
                    {renderChange(topCards[0].market_data?.change_24h, true)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NO.2 & NO.3 Cards */}
        {topCards.slice(1, 3).map((card, idx) => (
          <div 
            key={card.id || card.card_id} 
            onClick={() => navigate(`/product/${card.id || card.card_id}`)}
            className="col-span-1 relative rounded-3xl overflow-hidden border border-white/5 bg-black flex flex-col shadow-xl cursor-pointer hover:scale-[1.02] transition-transform duration-300"
          >
            {/* Image Section - Matches exact card aspect ratio */}
            <div className="relative w-full aspect-[63/88] bg-black">
              <div className="absolute top-3 left-3 z-20 text-gray-300 text-2xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,1)] tracking-tighter italic">NO.{idx + 2}</div>
              <img 
                src={getHighResImage(card.image_url || (card as any).imageUrl || (card as any).imageURL, card.name_zh, `${card.set_name}|${card.card_number}`)} 
                alt={card.name_zh} 
                className={getImageClass(getHighResImage(card.image_url || (card as any).imageUrl || (card as any).imageURL, card.name_zh, `${card.set_name}|${card.card_number}`))}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, card.image_url || (card as any).imageUrl || (card as any).imageURL, card.name_zh)}
              />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black to-transparent opacity-90"></div>
            </div>

            {/* Info Section - Solid Black Background */}
            <div className="px-3 pb-4 pt-0 relative z-10 bg-black flex flex-col flex-grow">
              <h4 className="text-white text-xs sm:text-sm font-bold truncate mb-2">{card.name_zh}</h4>
              <div className="flex flex-col gap-0.5 mt-auto">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">PSA10 snkrdunk 售價</span>
                <span className="text-gray-300 text-sm font-bold tracking-tight">HK$ {card.market_data?.snkrdunk_price?.toLocaleString()}</span>
                <span className="text-xs font-bold">{renderChange(card.market_data?.change_24h)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

        {/* Expand Button & Remaining Cards */}
        {remainingCards.length > 0 && (
          <div className="mt-4">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full bg-[#1c1c1e] rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-3 active:scale-[0.98] transition-all border border-white/5 hover:bg-[#222]"
            >
              <span className="text-gray-400 text-sm font-black tracking-tight">
                查看 NO.4 - NO.10 的完整實時排行榜
              </span>
              <div className={`p-2 rounded-full bg-white/5 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-6 h-6 text-white" />
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-2">
                    {remainingCards.map((card) => (
                      <div 
                        key={card.id || card.card_id} 
                        onClick={() => navigate(`/product/${card.id || card.card_id}`)}
                        className="bg-gray-50 dark:bg-[#1c1c1e] rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#222] transition-colors border border-gray-100 dark:border-transparent"
                      >
                        <div className="w-8 text-gray-400 font-bold text-sm text-center tracking-tighter">
                          NO.{card.rank}
                        </div>
                        <div className="w-10 aspect-[3/4] flex items-center justify-center bg-white dark:bg-black/40 rounded border border-gray-200 dark:border-white/5 p-0.5 overflow-hidden">
                          <img 
                            src={getHighResImage(card.image_url || (card as any).imageUrl || (card as any).imageURL)} 
                            alt={card.name_zh} 
                            className={getImageClass(card.image_url || (card as any).imageUrl || (card as any).imageURL)}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.includes('placehold.co')) {
                                target.src = `https://placehold.co/100x140/1c1c1e/aaaaaa?text=TCG`;
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-gray-900 dark:text-white text-xs font-bold truncate">{card.name_zh}</h4>
                          <div className="text-[10px] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span className="text-gray-500 dark:text-gray-400 font-bold">PSA10 snkrdunk 售價</span>
                            <span className="text-gray-500 dark:text-gray-400 font-medium">HK$ {card.market_data?.snkrdunk_price?.toLocaleString()}</span>
                            {renderChange(card.market_data?.change_24h)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
