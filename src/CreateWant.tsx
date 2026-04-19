import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Search, ArrowRight, Loader2, Image as ImageIcon, Camera, X, Upload } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { compressImage } from './lib/imageUtils';

export const CreateWant = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState('RAW 卡');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const CONDITIONS = ['RAW 卡', 'PSA10', 'PSA9', 'PSA8', 'under PSA8'];
  const AVAILABLE_TAGS = ['有卡傷', '有白點', '有白邊', 'PSA殼有花', 'PSA殼有裂痕', '美品', '大細邊', '置中卡'];

  const MOCK_PRODUCTS: Record<string, any> = {
    'override_van_gogh_pikachu': {
      name_zh: '戴灰氈帽的皮卡丘 (Promo)',
      card_number: '085',
      image_url: 'https://images.pokemontcg.io/svp/85_hires.png',
    },
    'override_mew_ex_sv2a': {
      name_zh: '夢幻 ex (泡泡 SAR)',
      card_number: '205/165',
      image_url: 'https://den-cards.pokellector.com/371/Mew-ex.SV2A.205.48354.png',
    },
    'override_mew_ex': {
      name_zh: '夢幻 ex (SAR)',
      card_number: '347/190',
      image_url: 'https://www.pokemon-card.com/assets/images/card_images/large/SV4a/045133_P_MIXYUUEX.jpg',
    }
  };

  // Card Number Auto-Matching
  React.useEffect(() => {
    const matchCard = async () => {
      const code = cardNumber.trim();
      if (!code || code.length < 3) return;

      setIsMatching(true);
      try {
        // 1. Check Mock Data
        const mockMatch = Object.values(MOCK_PRODUCTS).find(p => p.card_number === code);
        if (mockMatch) {
          setImageUrl(mockMatch.image_url);
          if (!title) setTitle(mockMatch.name_zh);
          toast.success(`已自動匹配卡牌：${mockMatch.name_zh}`, {
            duration: 3000
          });
          setIsMatching(false);
          return;
        }

        // 2. Query Firestore
        const q = query(collection(db, 'products'), where('card_number', '==', code));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const img = data.image_url || data.imageUrl;
          if (img) {
            setImageUrl(img);
            if (!title) setTitle(data.name_zh || '');
            toast.success(`已自動匹配卡牌：${data.name_zh}`, {
              description: `卡號 ${code} 已成功配對圖片`,
              duration: 3000
            });
          }
        }
      } catch (err) {
        console.error("Match error:", err);
      } finally {
        setIsMatching(false);
      }
    };

    const timer = setTimeout(matchCard, 800);
    return () => clearTimeout(timer);
  }, [cardNumber]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      try {
        const compressedBase64 = await compressImage(file);
        setImageUrl(compressedBase64);
        toast.success('圖片已準備就緒');
      } catch (error) {
        console.error('Error handling image upload:', error);
        toast.error('圖片處理失敗');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('請先登入');
      return;
    }
    if (!title || !targetPrice) {
      setError('請填寫所有必填欄位');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let finalImageUrl = imageUrl || '';

      // If a new physical file was selected, upload it
      if (imageFile) {
        const imageRef = ref(storage, `wants/${user.uid}/${Date.now()}_${imageFile.name}`);
        const uploadResult = await uploadBytes(imageRef, imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }

      await addDoc(collection(db, 'wantListings'), {
        title,
        cardNumber,
        targetPrice: Number(targetPrice),
        condition,
        description,
        tags: selectedTags,
        imageUrl: finalImageUrl,
        userId: user.uid,
        userName: user.displayName || '匿名買家',
        userPhoto: user.photoURL || '',
        createdAt: serverTimestamp(),
        status: 'active'
      });

      navigate('/'); // Redirect to home or marketplace after success
    } catch (err: any) {
      console.error('Error creating want listing:', err);
      setError(err.message || '發佈失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 sm:pt-32 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#111] rounded-[2rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden p-6 sm:p-8"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">發佈徵求</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">尋找您心儀的卡牌，讓賣家主動聯繫您</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Selection Area */}
          <div className="flex flex-col items-center gap-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            {imageUrl ? (
              <div className="relative group">
                <div className="relative w-40 h-56 sm:w-48 sm:h-64 rounded-2xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl">
                  <img 
                    src={imageUrl} 
                    alt="Card Preview" 
                    className="w-full h-full object-contain bg-gray-50 dark:bg-black/40" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-all active:scale-95"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(null);
                    setImageFile(null);
                  }}
                  className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-40 h-56 sm:w-48 sm:h-64 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex flex-col items-center justify-center gap-3 group hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center px-4">
                  <p className="text-xs font-bold text-gray-400 group-hover:text-indigo-400 mb-1">輸入卡號碼即自動配對卡圖</p>
                  <p className="text-[10px] text-gray-300 font-medium tracking-tight">或者點擊上傳圖片</p>
                </div>
              </button>
            )}
          </div>

          {/* Title and Card Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">徵求卡牌名稱 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                placeholder="例如：夢幻 VMAX SA"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                <span>卡號碼</span>
                {isMatching && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                placeholder="例如：201/165"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Target Price */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">期望價格 (HK$) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                  placeholder="最高願意支付的價格"
                />
              </div>
            </div>

            {/* Condition/Grade */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">評級狀態 <span className="text-red-500">*</span></label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white appearance-none"
              >
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">要求標籤</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTags(prev => 
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:border-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">備註說明</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white resize-none"
              placeholder="例如：只收無白邊、面交地點等..."
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  發佈中...
                </>
              ) : (
                <>
                  確認發佈徵求
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
