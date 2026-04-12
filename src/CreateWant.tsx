import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Search, ArrowRight, Loader2, Image as ImageIcon, Scan } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'motion/react';
import { CardSearchModal } from './components/CardSearchModal';
import { SchemaType } from '@google/generative-ai';
import { toast } from 'sonner';
import { compressImage } from './lib/imageUtils';

export const CreateWant = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState('NM');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const CONDITIONS = ['Any', 'Mint (M)', 'Near Mint (NM)', 'Lightly Played (LP)', 'PSA 10', 'PSA 9', 'BGS 10', 'BGS 9.5'];

  const handleCardSelect = (card: any) => {
    setTitle(card.cardNameViewText);
    setSelectedCardId(card.cardID);
    setImageUrl(`https://www.pokemon-card.com${card.cardThumbFile}`);
    setIsSearchModalOpen(false);
  };

  const handleAIImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      try {
        const compressedBase64 = await compressImage(file);

        setIsAnalyzing(true);
        try {
          const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: compressedBase64,
              prompt: 'Identify this Pokemon card. Return ONLY a valid JSON object with a single key "name" containing the Pokemon\'s name or character\'s name in Traditional Chinese or Japanese (e.g., {"name": "噴火龍"}). If you cannot identify it, return {"name": "Unknown"}. Do not include markdown formatting.',
              schema: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING, description: "Card name in Traditional Chinese or Japanese. Return 'Unknown' if cannot identify." }
                },
                required: ["name"]
              }
            })
          });

          if (!response.ok) {
            let errorMessage = '辨識失敗';
            try {
              const text = await response.text();
              try {
                const errData = JSON.parse(text);
                errorMessage = errData.error || errorMessage;
              } catch (e) {
                errorMessage = `伺服器錯誤 (${response.status}): ${text.substring(0, 100)}`;
              }
            } catch (e) {
              errorMessage = `伺服器錯誤 (${response.status})`;
            }
            throw new Error(errorMessage);
          }

          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("Invalid JSON response:", text);
            throw new Error(`伺服器回傳了非預期的格式: ${text.substring(0, 100)}`);
          }

          if (data && data.name && data.name !== "Unknown") {
            setTitle(data.name);
            toast.success(`AI 辨識成功：${data.name}`);
            // Optionally set it as the preview image for the want listing
            setImageUrl(compressedBase64);
            setSelectedCardId(null);
          } else {
            toast.error('無法辨識卡牌，請確保圖片清晰並重試');
          }
        } catch (err: any) {
          console.error('AI Error:', err);
          toast.error(`AI 辨識失敗: ${err.message || '未知錯誤'}`);
        } finally {
          setIsAnalyzing(false);
          // reset input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error handling AI image select:', error);
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
      await addDoc(collection(db, 'wantListings'), {
        title,
        targetPrice: Number(targetPrice),
        condition,
        description,
        imageUrl: imageUrl || '',
        officialCardId: selectedCardId,
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
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 pb-32">
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
          {/* Official DB Search Button */}
          <div>
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold transition-colors border border-indigo-100 dark:border-indigo-500/20"
            >
              <Search className="w-5 h-5" />
              從官方資料庫搜尋卡牌 (自動帶入名稱與圖片)
            </button>
          </div>

          {/* Selected Image Preview */}
          {imageUrl && (
            <div className="flex justify-center">
              <div className="relative w-32 h-44 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                <img src={imageUrl} alt="Card Preview" className="w-full h-full object-contain bg-gray-50 dark:bg-[#1a1a1a]" />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">徵求卡牌名稱 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                placeholder="例如：夢幻 VMAX SA"
              />
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleAIImageSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
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

            {/* Condition */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">要求卡況 <span className="text-red-500">*</span></label>
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
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">備註說明</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white resize-none"
              placeholder="例如：只收無白邊、面交地點等..."
            />
          </div>

          {/* Submit Button */}
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
      <CardSearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
        onSelect={handleCardSelect} 
      />
    </div>
  );
};
