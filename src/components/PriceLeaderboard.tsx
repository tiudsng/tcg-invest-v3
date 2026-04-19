import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { getHighResImage } from '../lib/imageUtils';

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
    card_id: 'mew_ex_usgmen',
    rank: 1,
    name_zh: '夢幻 ex (SAR)',
    name_jp: 'ミュウex',
    card_number: '347/190',
    set_name: 'SV4a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    market_data: { snkrdunk_price: 15800, ebay_price: 15800, change_24h: '+8.4%', status: 'up' }
  },
  {
    card_id: 'van_gogh_pikachu',
    rank: 2,
    name_zh: '梵高皮卡丘 (Promo)',
    name_jp: 'ゴッホ ピカチュウ',
    card_number: '085/SVP',
    set_name: 'Promo',
    image_url: 'https://images.pokemontcg.io/swsh12pt5/85_hires.png',
    market_data: { snkrdunk_price: 8800, ebay_price: 8800, change_24h: '+5.1%', status: 'up' }
  },
  {
    card_id: 'mew_151_sar',
    rank: 3,
    name_zh: '夢幻 ex (泡泡 SAR)',
    name_jp: 'ミュウex',
    card_number: '205/165',
    set_name: 'SV2a 151',
    image_url: 'https://images.pokemontcg.io/sv2a/205_hires.png',
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
    card_id: 'lillie_determination_sv9',
    rank: 6,
    name_zh: '莉莉艾的決意 (Mega 2026)',
    name_jp: 'リーリエの全力',
    card_number: 'SV9 SAR',
    set_name: 'SV9',
    image_url: 'https://placehold.co/400x560/f8d7da/721c24?text=Lillie+SV9',
    market_data: { snkrdunk_price: 5800, ebay_price: 5800, change_24h: '+12.4%', status: 'up' }
  },
  {
    card_id: 'pikachu_ex_sv8a',
    rank: 7,
    name_zh: '皮卡丘 ex (超電突波 UR)',
    name_jp: 'ピカチュウex',
    card_number: '236/187',
    set_name: 'SV8a',
    image_url: 'https://images.pokemoncard.io/cards/sv8a/236.png',
    market_data: { snkrdunk_price: 3200, ebay_price: 3200, change_24h: '-2.1%', status: 'down' }
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
        return {
          id: doc.id,
          ...data,
          // Ensure market_data exists even if flat in the list_1 document
          market_data: data.market_data || {
            snkrdunk_price: data.snkrdunk_price || data.price || 0,
            ebay_price: data.ebay_price || data.price || 0,
            change_24h: data.change_24h || '0%',
            status: data.status || 'stable'
          }
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

  const getImageClass = (url?: string) => {
    const baseClass = "w-full h-full object-contain transition-transform duration-500";
    if (!url) return baseClass;
    // Scale up all card images to fill the display area
    return `${baseClass} scale-[1.6] hover:scale-[1.65]`;
  };

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
                  src={getHighResImage(topCards[0].image_url || (topCards[0] as any).imageUrl || (topCards[0] as any).imageURL)} 
                  alt={topCards[0].name_zh} 
                  className={getImageClass(topCards[0].image_url || (topCards[0] as any).imageUrl || (topCards[0] as any).imageURL)}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('placehold.co')) {
                      target.src = `https://placehold.co/600x840/111/d4af37?text=${encodeURIComponent(topCards[0].name_zh)}`;
                    }
                  }}
                />
              {/* Overlay Gradient to blend to black smoothly without hiding the card's bottom arts completely */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent opacity-90"></div>
            </div>
            
            {/* Info Section - Solid Black Background flush with gradient */}
            <div className="px-5 pb-5 pt-0 relative z-10 bg-black flex flex-col">
              <div className="flex justify-between items-center gap-3 mb-2">
                <h3 className="text-white font-bold text-lg sm:text-xl uppercase leading-tight line-clamp-2">
                  {topCards[0].name_zh} {topCards[0].set_name ? `- ${topCards[0].set_name}` : ''} {topCards[0].card_number ? `#${topCards[0].card_number}` : ''}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[12px] font-bold text-white italic opacity-80 uppercase">ebay</span>
                  <div className="flex flex-col items-center justify-center opacity-80">
                    <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">C</div>
                    <span className="text-[6px] text-white uppercase font-bold mt-0.5 tracking-wider">OpenClaw</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-[#d4af37] text-3xl sm:text-4xl font-bold tracking-tighter">
                  <AnimatedPrice price={topCards[0].market_data?.snkrdunk_price || 0} />
                </span>
                <span className="text-sm font-bold">
                  {renderChange(topCards[0].market_data?.change_24h, true)}
                </span>
              </div>

              <div className="text-gray-500 text-[10px] font-medium border-t border-white/10 pt-3">
                由 AI 和 OpenClaw 技術驅動 - 價格實時排行榜
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
              <div className="absolute top-3 right-3 z-20 bg-black/80 backdrop-blur border border-white/10 text-white text-[8px] font-black px-1.5 py-1 rounded leading-none text-center uppercase tracking-tighter">SNKR<br/>DUNK</div>
              <img 
                src={getHighResImage(card.image_url || (card as any).imageUrl || (card as any).imageURL)} 
                alt={card.name_zh} 
                className={getImageClass(card.image_url || (card as any).imageUrl || (card as any).imageURL)}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('placehold.co')) {
                    target.src = `https://placehold.co/400x560/111/aaaaaa?text=${encodeURIComponent(card.name_zh)}`;
                  }
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black to-transparent opacity-90"></div>
            </div>

            {/* Info Section - Solid Black Background */}
            <div className="px-3 pb-4 pt-0 relative z-10 bg-black flex flex-col flex-grow">
              <h4 className="text-white text-xs sm:text-sm font-bold truncate mb-2">{card.name_zh}</h4>
              <div className="flex flex-col gap-0.5 mt-auto">
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
                          <div className="text-[10px] flex items-center gap-1.5 mt-0.5">
                            <span className="text-gray-500 dark:text-gray-400">HK$ {card.market_data?.snkrdunk_price?.toLocaleString()}</span>
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
