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
  'override_van_gogh_pikachu': {
    id: 'override_van_gogh_pikachu',
    card_id: 'van_gogh_pikachu_en',
    rank: 2,
    name_zh: '戴灰氈帽的皮卡丘 (Promo)',
    name_jp: 'Pikachu with Grey Felt Hat',
    card_number: '085',
    set_name: 'SVP Black Star Promos',
    image_url: 'https://images.pokemontcg.io/svp/85_hires.png',
    market_data: { snkrdunk_price: 8800, ebay_price: 8800, change_24h: '+5.1%', status: 'up' }
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
  'mew_ex_usgmen': {
    id: 'mew_ex_usgmen',
    card_id: 'mew_ex_usgmen',
    rank: 1,
    name_zh: '夢幻 ex (SAR)',
    name_jp: 'ミュウex',
    card_number: '347/190',
    set_name: 'SV4a',
    image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    market_data: { snkrdunk_price: 15828, ebay_price: 15828, change_24h: '+15.4%', status: 'up' }
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
          setProduct({
            id: docSnap.id,
            ...cardData,
            // Fallback for card_id if not present
            card_id: cardData.card_id || docSnap.id,
            market_data: cardData.market_data || {
              snkrdunk_price: cardData.snkrdunk_price || cardData.price || 0,
              ebay_price: cardData.ebay_price || cardData.price || 0,
              change_24h: cardData.change_24h || '0%',
              status: cardData.status || 'stable'
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32">
      <div className="max-w-6xl mx-auto pt-20 sm:pt-24 md:pt-32 md:px-12">
        <div className="bg-[#111] md:rounded-[3rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row">
          
          {/* Image Section */}
          <div className="w-full md:w-[55%] aspect-[3/4] md:aspect-auto md:min-h-[700px] bg-black relative flex items-center justify-center p-0 md:p-12">
            <img 
              src={product.image_url || product.imageUrl || (product as any).imageURL} 
              alt={product.name_zh} 
              className="w-full h-full object-contain md:drop-shadow-[0_0_50px_rgba(212,175,55,0.2)]"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes('placehold.co')) {
                  target.src = `https://placehold.co/600x840/111/d4af37?text=${encodeURIComponent(product.name_zh)}`;
                }
              }}
            />
          </div>

          {/* Details Section */}
          <div className="w-full md:w-[45%] p-8 sm:p-12 flex flex-col">
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="px-3 py-1.5 bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#d4af37]" />
                  <span className="text-xs font-black text-[#d4af37] uppercase tracking-widest">RANK {product.rank}</span>
                </div>
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

              {/* Extended Details */}
              {(product as any).description && (
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">卡片描述</h4>
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">{(product as any).description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
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
