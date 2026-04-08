import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ArrowLeft, TrendingUp, ExternalLink, LineChart, Activity, ShoppingBag, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface Product {
  id?: string;
  card_id: string;
  rank: number;
  name_zh: string;
  name_jp: string;
  card_number?: string;
  set_name: string;
  image_url: string;
  imageUrl?: string;
  market_data: {
    snkrdunk_price: number;
    ebay_price: number;
    change_24h: string;
    status: string;
  };
}

// Fallback mock data in case the ID is from the mock list
const MOCK_PRODUCTS: Record<string, Product> = {
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
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProduct({
            id: docSnap.id,
            ...data,
            market_data: data.market_data || {
              snkrdunk_price: data.snkrdunk_price || data.price || 0,
              ebay_price: data.ebay_price || data.price || 0,
              change_24h: data.change_24h || '0%',
              status: data.status || 'stable'
            }
          } as Product);
        } else {
          setError('找不到此排行榜卡片');
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white pointer-events-auto hover:bg-black/60 border border-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto md:pt-32 md:px-12">
        <div className="bg-[#111] md:rounded-[3rem] shadow-2xl border-x border-b md:border border-white/5 overflow-hidden flex flex-col md:flex-row">
          
          {/* Image Section */}
          <div className="w-full md:w-[55%] aspect-[3/4] md:aspect-auto md:min-h-[700px] bg-black relative flex items-center justify-center p-12">
            <div className="absolute top-8 left-8 z-10 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-[#d4af37]" />
              <span className="text-[#d4af37] font-black text-base tracking-[0.2em]">RANK {product.rank}</span>
            </div>
            <img 
              src={product.image_url || product.imageUrl || 'https://placehold.co/600x840/111111/d4af37?text=Card+Image'} 
              alt={product.name_zh} 
              className="max-w-full max-h-full object-contain drop-shadow-[0_0_50px_rgba(212,175,55,0.2)]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/600x840/111111/d4af37?text=Image+Error';
              }}
            />
          </div>

          {/* Details Section */}
          <div className="w-full md:w-[45%] p-8 sm:p-12 flex flex-col">
            <div className="mb-10">
              <div className="flex flex-wrap gap-3 mb-4">
                {product.set_name && (
                  <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-black text-gray-400 uppercase tracking-widest">
                    {product.set_name}
                  </span>
                )}
                {product.card_number && (
                  <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-black text-gray-400 uppercase tracking-widest">
                    #{product.card_number}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-3 tracking-tight">
                {product.name_zh}
              </h1>
              <p className="text-lg text-gray-400 font-bold tracking-tight">{product.name_jp}</p>
            </div>

            {/* Price Section */}
            <div className="p-8 bg-[#1c1c1e] rounded-[2rem] border border-white/5 mb-10 shadow-inner">
              <div className="flex items-center gap-3 text-gray-500 mb-4">
                <Activity className="w-5 h-5" />
                <span className="text-sm font-black uppercase tracking-widest">當前市場均價</span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="text-5xl sm:text-7xl font-black text-[#d4af37] tracking-tighter">
                  HK${(product.market_data?.snkrdunk_price || 0).toLocaleString()}
                </span>
                <span className={`text-xl font-black ${changeColor}`}>
                  {changeDisplay} (24h)
                </span>
              </div>
            </div>

            {/* Market Comparison */}
            <div className="space-y-6 flex-grow">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">市場平台報價</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-black/40 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/60 transition-colors">
                  <span className="text-[10px] font-black bg-white text-black px-2 py-1 rounded-md mb-3 tracking-widest">SNKRDUNK</span>
                  <span className="text-2xl font-black text-white tracking-tight">HK${(product.market_data?.snkrdunk_price || 0).toLocaleString()}</span>
                </div>
                <div className="p-6 bg-black/40 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center hover:bg-black/60 transition-colors">
                  <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded-md mb-3 tracking-widest">eBay</span>
                  <span className="text-2xl font-black text-white tracking-tight">HK${(product.market_data?.ebay_price || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-12 pt-8 border-t border-white/10 flex gap-4">
              <button 
                onClick={() => navigate(`/?search=${encodeURIComponent(product.name_zh)}`)}
                className="flex-1 bg-white hover:bg-gray-200 text-black py-5 rounded-[1.5rem] font-black text-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-white/10"
              >
                <ShoppingBag className="w-6 h-6" />
                在市集尋找此卡
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                價格數據由 AI 與 OpenClaw 實時抓取，僅供參考。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
