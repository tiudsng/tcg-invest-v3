import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

interface Product {
  id?: string;
  card_id: string;
  rank: number;
  name_zh: string;
  name_jp: string;
  card_number?: string;
  set_name: string;
  image_url: string;
  market_data: {
    snkrdunk_price: number;
    ebay_price: number;
    change_24h: string;
    status: string;
  };
}

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
  {
    id: 'mock2',
    card_id: 'c2',
    rank: 2,
    name_zh: 'Giratina V SA',
    name_jp: 'ギラティナV',
    set_name: 'LOST ABYSS',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Giratina+V',
    market_data: { snkrdunk_price: 7950, ebay_price: 7950, change_24h: '+3.7%', status: 'up' }
  },
  {
    id: 'mock3',
    card_id: 'c3',
    rank: 3,
    name_zh: 'Umbreon VMAX SA',
    name_jp: 'ブラッキーVMAX',
    set_name: 'EEVEE HEROES',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Umbreon+VMAX',
    market_data: { snkrdunk_price: 4110, ebay_price: 4110, change_24h: '-1.2%', status: 'down' }
  },
  {
    id: 'mock4',
    card_id: 'c4',
    rank: 4,
    name_zh: 'Charizard VMAX',
    name_jp: 'リザードンVMAX',
    set_name: 'SHINING FATES',
    image_url: 'https://placehold.co/400x560/1c1c1e/aaaaaa?text=Charizard',
    market_data: { snkrdunk_price: 2150, ebay_price: 2150, change_24h: '+1.5%', status: 'up' }
  }
];

export const PriceLeaderboard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      orderBy('rank', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Firestore snapshot received, docs count:", snapshot.docs.length);
      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log("Doc data:", doc.id, data);
        return {
          id: doc.id,
          ...data,
          // Ensure market_data exists even if flat
          market_data: data.market_data || {
            snkrdunk_price: data.snkrdunk_price || data.price || 0,
            ebay_price: data.ebay_price || data.price || 0,
            change_24h: data.change_24h || '0%',
            status: data.status || 'stable'
          }
        };
      }) as any[];
      
      // Fallback to mock data if database is empty or not connected
      if (productsData.length === 0) {
        setProducts(MOCK_PRODUCTS);
      } else {
        setProducts(productsData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      // Fallback to mock data on error
      setProducts(MOCK_PRODUCTS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0a0a] rounded-3xl py-12 flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#d4af37] mb-4"></div>
        <p className="text-[#d4af37] text-sm font-medium">載入排行榜中...</p>
      </div>
    );
  }

  const topCards = products.slice(0, 3);
  const remainingCards = products.slice(3);

  return (
    <div className="mb-12 sm:mb-16 bg-[#0a0a0a] rounded-3xl p-4 sm:p-6 shadow-2xl overflow-hidden border border-white/5">
      <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {/* NO.1 Card */}
        {topCards[0] && (
          <div 
            onClick={() => navigate(`/product/${topCards[0].id || topCards[0].card_id}`)}
            className="col-span-2 lg:col-span-1 relative rounded-2xl overflow-hidden border border-[#d4af37] bg-[#111] flex flex-col shadow-[0_0_15px_rgba(212,175,55,0.15)] cursor-pointer hover:scale-[1.02] transition-transform duration-300"
          >
            {/* Image Section */}
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] lg:aspect-[3/4] bg-gray-900">
              <div className="absolute top-3 left-3 z-10 text-[#d4af37] text-2xl sm:text-3xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter">NO.1</div>
                <img 
                  src={topCards[0].image_url || (topCards[0] as any).imageUrl || 'https://placehold.co/600x450/1c1c1e/888888?text=Card+Image'} 
                  alt={topCards[0].name_zh} 
                  className="w-full h-full object-cover lg:object-contain lg:p-4"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x450/1c1c1e/888888?text=Image+Error';
                  }}
                />
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#111] to-transparent"></div>
            </div>
            
            {/* Info Section */}
            <div className="p-4 pt-0 relative z-10 bg-[#111] flex-grow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h3 className="text-white font-bold text-sm sm:text-base uppercase leading-tight line-clamp-2">
                    {topCards[0].name_zh} {topCards[0].set_name ? `- ${topCards[0].set_name}` : ''} {topCards[0].card_number ? `#${topCards[0].card_number}` : ''}
                  </h3>
                  <div className="flex gap-2 shrink-0 items-center mt-0.5">
                    <span className="text-xs font-bold text-white italic">ebay</span>
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[8px] text-white font-bold">C</div>
                      <span className="text-[5px] text-white uppercase mt-0.5">OpenClaw</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-[#d4af37] text-2xl sm:text-3xl font-black tracking-tight">
                    <AnimatedPrice price={topCards[0].market_data?.snkrdunk_price || 0} />
                  </span>
                  <span className="text-sm font-bold">
                    {renderChange(topCards[0].market_data?.change_24h, true)}
                  </span>
                </div>
              </div>
              <div className="text-gray-400 text-[10px] font-medium border-t border-white/10 pt-2 mt-2">
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
            className="col-span-1 bg-[#1c1c1e] rounded-2xl p-4 sm:p-6 flex flex-col relative border border-transparent cursor-pointer hover:border-white/10 hover:bg-[#222] transition-all shadow-lg"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-gray-400 font-black text-lg sm:text-xl tracking-tighter">NO.{idx + 2}</span>
              <div className="bg-white text-black text-[10px] font-black px-2 py-1 rounded leading-tight text-center uppercase tracking-tighter">SNKR<br/>DUNK</div>
            </div>
            <div className="w-full aspect-[3/4] flex items-center justify-center mb-6">
              <img 
                src={card.image_url || (card as any).imageUrl || 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'} 
                alt={card.name_zh} 
                className="max-w-full max-h-full object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x560/1c1c1e/888888?text=Image+Error';
                }}
              />
            </div>
            <div className="mt-auto">
              <h4 className="text-white text-sm sm:text-lg font-black truncate mb-1 tracking-tight">{card.name_zh}</h4>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="text-[#d4af37] font-black text-base sm:text-xl">HK$ {card.market_data?.snkrdunk_price?.toLocaleString()}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 hidden sm:inline">/</span>
                  <span className="text-sm font-bold">{renderChange(card.market_data?.change_24h)}</span>
                </div>
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
              className="w-full bg-[#1c1c1e] rounded-2xl p-4 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-transform"
            >
              <span className="text-gray-400 text-xs font-medium">
                查看 NO.4 - NO.10 的完整實時排行榜
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
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
                        className="bg-[#1c1c1e] rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#222] transition-colors"
                      >
                        <div className="w-8 text-gray-400 font-bold text-sm text-center tracking-tighter">
                          NO.{card.rank}
                        </div>
                        <div className="w-10 aspect-[3/4] flex items-center justify-center bg-black/40 rounded border border-white/5 p-0.5">
                          <img 
                            src={card.image_url || (card as any).imageUrl || 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'} 
                            alt={card.name_zh} 
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/400x560/1c1c1e/888888?text=Error';
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-xs font-bold truncate">{card.name_zh}</h4>
                          <div className="text-[10px] flex items-center gap-1.5 mt-0.5">
                            <span className="text-gray-400">HK$ {card.market_data?.snkrdunk_price?.toLocaleString()}</span>
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
