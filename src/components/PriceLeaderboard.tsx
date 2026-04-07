import React, { useState, useEffect, useRef } from 'react';
import { Trophy, TrendingUp, TrendingDown, Flame, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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

export const PriceLeaderboard = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      orderBy('rank', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-gray-100 dark:border-white/5 py-12 flex flex-col justify-center items-center h-64 transition-all duration-300 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400 text-sm font-medium">載入數據中...</p>
      </div>
    );
  }

  const topCards = products.slice(0, 3);
  const remainingCards = products.slice(3);

  const getChangeColor = (change: string) => {
    if (!change) return 'text-gray-400';
    return change.startsWith('+') ? 'text-[#30d158]' : 'text-[#ff453a]';
  };

  return (
    <div className="mb-12 sm:mb-16 bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-300">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-6 py-2 bg-white dark:bg-white/10 rounded-full shadow-sm border border-gray-100 dark:border-white/5 mb-6">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">十大活躍</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-black flex items-center justify-center gap-3 mb-3 text-gray-900 dark:text-white tracking-tight">
          [ 🔥 十大活躍排行榜 ]
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold tracking-[0.2em] uppercase">頭三名顯示 (Top 3 Focus)</p>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {topCards[0] && (
          <div className="relative bg-gray-50 dark:bg-black rounded-[2.5rem] p-6 sm:p-10 flex flex-col md:flex-row gap-6 sm:gap-10 border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-500 group overflow-hidden">
            <div className="absolute -top-8 -left-6 text-6xl sm:text-8xl z-10 drop-shadow-2xl transform -rotate-12 group-hover:rotate-0 transition-transform duration-700 opacity-90">👑</div>
            <div className="w-full md:w-56 aspect-square md:aspect-[3/4] shrink-0 rounded-3xl overflow-hidden bg-white dark:bg-[#1c1c1e] shadow-2xl border border-gray-100 dark:border-white/5 relative z-0 p-4 flex items-center justify-center">
              <img 
                src={topCards[0].image_url || 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'} 
                alt={topCards[0].name_zh} 
                className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-xl"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'; }}
              />
            </div>
            <div className="flex-1 flex flex-col justify-between py-2">
              <div>
                <div className="flex items-start justify-between mb-4 sm:mb-8">
                  <div className="flex flex-col">
                    <span className="text-4xl sm:text-7xl font-black tracking-tighter text-gray-900 dark:text-white leading-none mb-2">NO.1</span>
                    <span className="inline-flex px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest w-fit">Market Leader</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-xl leading-tight text-center tracking-tighter shadow-lg">SNKR<br/>DUNK</div>
                  </div>
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight mb-2">
                  {topCards[0].name_zh}<br/>
                  {topCards[0].card_number && <span className="text-xs sm:text-sm text-blue-500 font-bold block mt-1 uppercase tracking-widest">{topCards[0].card_number}</span>}
                  <span className="text-sm sm:text-lg text-gray-500 dark:text-gray-400 font-medium">[{topCards[0].set_name || 'TCG'}]</span>
                </h3>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 mt-6">
                <span className={`${getChangeColor(topCards[0].market_data?.change_24h)} font-black text-2xl sm:text-5xl tracking-tighter`}>
                  {topCards[0].market_data?.change_24h || '-'}
                </span>
                <span className="text-gray-400 dark:text-gray-500 font-bold text-lg sm:text-3xl">
                  / <AnimatedPrice price={topCards[0].market_data?.snkrdunk_price || 0} className="text-gray-900 dark:text-white" />
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-8">
          {topCards.slice(1, 3).map((card, idx) => (
            <div key={card.id || card.card_id} className="bg-gray-50 dark:bg-black rounded-[1.5rem] sm:rounded-[2.5rem] p-3 sm:p-8 flex flex-col sm:flex-row gap-3 sm:gap-8 border border-gray-100 dark:border-white/5 shadow-sm transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-2 right-3 text-2xl sm:text-5xl opacity-5 font-black italic select-none">0{idx + 2}</div>
              <div className="w-full sm:w-32 aspect-[3/4] shrink-0 rounded-xl sm:rounded-2xl overflow-hidden bg-white dark:bg-[#1c1c1e] shadow-lg border border-gray-100 dark:border-white/5 relative z-0 p-1.5 sm:p-2 flex items-center justify-center">
                <img 
                  src={card.image_url || 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'} 
                  alt={card.name_zh} 
                  className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-1000 ease-out drop-shadow-md"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'; }}
                />
              </div>
              <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                <div>
                  <span className="text-lg sm:text-4xl font-black tracking-tighter text-gray-900 dark:text-white leading-none block mb-1">NO.{card.rank}</span>
                  <h3 className="text-[10px] sm:text-base font-bold text-gray-900 dark:text-white leading-tight mt-0.5 line-clamp-1 sm:line-clamp-2">{card.name_zh}</h3>
                </div>
                <div className="flex flex-col gap-0.5 mt-2 sm:mt-4">
                  <span className={`${getChangeColor(card.market_data?.change_24h)} font-black text-sm sm:text-2xl tracking-tight`}>
                    {card.market_data?.change_24h || '-'}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-bold text-[9px] sm:text-sm truncate">
                    / <AnimatedPrice price={card.market_data?.snkrdunk_price || 0} className="text-gray-900 dark:text-white" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {remainingCards.length > 0 && (
          <div className="mt-8 sm:mt-12">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-center gap-3 py-5 bg-gray-50 hover:bg-gray-100 dark:bg-black dark:hover:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl text-sm sm:text-base font-bold text-gray-600 dark:text-gray-300 transition-all active:scale-95 shadow-sm"
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? '收起詳細列表' : `查看其餘 ${remainingCards.length} 名排名數據`}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-3 sm:space-y-4">
                    {remainingCards.map((card) => (
                      <div key={card.id || card.card_id} className="bg-gray-50/50 dark:bg-black/50 rounded-3xl p-4 flex items-center gap-4 sm:gap-6 border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-black transition-all duration-300 group">
                        <div className="w-10 font-black text-gray-400 dark:text-gray-600 text-xl sm:text-2xl text-center group-hover:text-blue-500 transition-colors italic">
                          {card.rank}
                        </div>
                        <div className="w-12 sm:w-16 aspect-square shrink-0 rounded-xl overflow-hidden bg-white dark:bg-[#1c1c1e] shadow-md border border-gray-100 dark:border-white/5 p-1 flex items-center justify-center">
                          <img 
                            src={card.image_url || 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'} 
                            alt={card.name_zh} 
                            className="w-full h-full object-contain transform group-hover:scale-110 transition-transform duration-700 drop-shadow-sm"
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x560/1c1c1e/888888?text=Card+Image'; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">{card.name_zh}</h4>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium truncate tracking-wide uppercase">{card.set_name || 'TCG'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-gray-900 dark:text-white font-black text-sm sm:text-lg">
                            <AnimatedPrice price={card.market_data?.snkrdunk_price || 0} />
                          </div>
                          <div className={`${getChangeColor(card.market_data?.change_24h)} font-bold text-xs sm:text-sm`}>
                            {card.market_data?.change_24h || '-'}
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
