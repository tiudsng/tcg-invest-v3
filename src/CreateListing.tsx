import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Camera, Upload, X, ArrowRight, Image as ImageIcon, Loader2, Search, Scan } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { motion } from 'motion/react';
import { CardSearchModal } from './components/CardSearchModal';
import { Type } from '@google/genai';
import { toast } from 'sonner';

export const CreateListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('NM');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const CONDITIONS = ['Mint (M)', 'Near Mint (NM)', 'Lightly Played (LP)', 'Moderately Played (MP)', 'Heavily Played (HP)', 'Damaged', 'PSA 10', 'PSA 9', 'BGS 10', 'BGS 9.5'];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAIAnalyze = async () => {
    if (!imagePreview) {
      toast.error('請先上傳圖片');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePreview,
          prompt: 'Identify this Pokemon card. Return ONLY a valid JSON object with a single key "name" containing the Pokemon\'s name or character\'s name in Traditional Chinese or Japanese (e.g., {"name": "噴火龍"}). If you cannot identify it, return {"name": "Unknown"}. Do not include markdown formatting.',
          schema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Card name in Traditional Chinese or Japanese. Return 'Unknown' if cannot identify." }
            },
            required: ["name"]
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '辨識失敗');
      }

      const data = await response.json();

      if (data && data.name && data.name !== "Unknown") {
        setTitle(data.name);
        toast.success(`AI 辨識成功：${data.name}`);
      } else {
        toast.error('無法辨識卡牌，請確保圖片清晰並重試');
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      toast.error(`AI 辨識失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCardSelect = async (card: any) => {
    setTitle(card.cardNameViewText);
    setSelectedCardId(card.cardID);
    setIsSearchModalOpen(false);
    
    // If no image is selected yet, use the official card image as preview
    if (!imageFile && !imagePreview) {
      setImagePreview(`https://www.pokemon-card.com${card.cardThumbFile}`);
      
      // Try to fetch the image and convert to File object
      try {
        const response = await fetch(`https://www.pokemon-card.com${card.cardThumbFile}`);
        const blob = await response.blob();
        const file = new File([blob], `${card.cardID}.jpg`, { type: 'image/jpeg' });
        setImageFile(file);
      } catch (err) {
        console.error('Error fetching official image:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('請先登入');
      return;
    }
    if (!title || !price || !imageFile) {
      setError('請填寫所有必填欄位並上傳圖片');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Upload Image
      const imageRef = ref(storage, `listings/${user.uid}/${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const imageUrl = await getDownloadURL(imageRef);

      // 2. Save to Firestore
      await addDoc(collection(db, 'listings'), {
        title,
        price: Number(price),
        condition,
        description,
        imageUrl,
        officialCardId: selectedCardId,
        sellerId: user.uid,
        sellerName: user.displayName || '匿名賣家',
        sellerPhoto: user.photoURL || '',
        createdAt: serverTimestamp(),
        status: 'active'
      });

      navigate('/'); // Redirect to home or marketplace after success
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err.message || '發佈失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#111] rounded-[2rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden p-6 sm:p-8"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">上架賣卡</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">拍下您的收藏，快速發佈到市集</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Official DB Search Button */}
          <div>
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold transition-colors border border-indigo-100 dark:border-indigo-500/20"
            >
              <Search className="w-5 h-5" />
              從官方資料庫搜尋卡牌 (自動帶入圖片與名稱)
            </button>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">卡牌圖片 <span className="text-red-500">*</span></label>
            <div className="relative">
              {imagePreview ? (
                <div className="relative w-full aspect-[4/3] sm:aspect-video rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); setSelectedCardId(null); }}
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAIAnalyze}
                    disabled={isAnalyzing}
                    className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600/90 hover:bg-blue-600 text-white rounded-xl backdrop-blur-md transition-all flex items-center gap-2 font-bold shadow-lg disabled:opacity-50"
                  >
                    {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
                    {isAnalyzing ? '辨識中...' : 'AI 辨識'}
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full aspect-[4/3] sm:aspect-video rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-[#1a1a1a] hover:bg-blue-50 dark:hover:bg-blue-500/5 cursor-pointer transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-gray-400 mb-3" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-bold">點擊上傳圖片</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">支援 PNG, JPG, WEBP</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">卡牌名稱 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                placeholder="例如：噴火龍 VMAX SSR"
              />
              <button
                type="button"
                onClick={handleAIAnalyze}
                disabled={isAnalyzing || !imagePreview}
                className="flex flex-col items-center justify-center w-16 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-blue-100 dark:border-blue-500/20"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Scan className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px] font-bold leading-none">AI 辨識</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Price */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">售價 (HK$) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">卡況 <span className="text-red-500">*</span></label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white appearance-none"
              >
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">詳細描述</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white resize-none"
              placeholder="描述卡片的細節、瑕疵或交易方式..."
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  上傳中...
                </>
              ) : (
                <>
                  確認上架
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
      <CardSearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
        onSelect={handleCardSelect} 
      />
    </div>
  );
};
