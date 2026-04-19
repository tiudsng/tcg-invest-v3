import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Camera, Upload, X, ArrowRight, ArrowLeft, Image as ImageIcon, Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { compressImage } from './lib/imageUtils';

export const CreateListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('');
  const [seriesCode, setSeriesCode] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('RAW 卡');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const CONDITIONS = ['RAW 卡', 'PSA10', 'PSA9', 'PSA8', 'under PSA8'];
  const AVAILABLE_TAGS = ['有卡傷', '有白點', '有白邊', 'PSA殼有花', 'PSA殼有裂痕', '美品', '大細邊', '置中卡'];

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const remainingSlots = 6 - imageFiles.length;
      
      if (files.length > remainingSlots) {
        toast.error(`最多只能上傳 6 張圖片，還剩下 ${remainingSlots} 個位子`);
        return;
      }

      const newFiles = files.slice(0, remainingSlots);
      
      try {
        const previews = await Promise.all(
          newFiles.map(file => compressImage(file))
        );
        
        setImageFiles(prev => [...prev, ...newFiles]);
        setImagePreviews(prev => [...prev, ...previews]);
      } catch (error) {
        console.error('Error handling images upload:', error);
        toast.error('圖片處理失敗');
      }
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('請先登入');
      return;
    }
    if (!title || !price || imageFiles.length === 0) {
      setError('請填寫所有必填欄位並至少上傳一張圖片');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Upload All Images
      const uploadPromises = imageFiles.map(async (file) => {
        const imageRef = ref(storage, `listings/${user.uid}/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(imageRef, file);
        return await getDownloadURL(uploadResult.ref);
      });

      const imageUrls = await Promise.all(uploadPromises);

      // 2. Save to Firestore
      await addDoc(collection(db, 'listings'), {
        title,
        seriesCode,
        cardNumber,
        price: Number(price),
        condition,
        description,
        tags: selectedTags,
        imageUrl: imageUrls[0], // First image as main
        imageUrls: imageUrls,    // All images
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
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-32">
      {/* iOS Style Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/10 px-4 h-16 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="px-2 py-1 text-blue-600 dark:text-blue-400 font-medium active:opacity-50 transition-all flex items-center gap-1"
        >
          <ArrowLeft className="w-5 h-5" />
          取消
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">上架賣卡</span>
        <button 
          form="create-listing-form"
          type="submit"
          disabled={loading}
          className="px-2 py-1 text-blue-600 dark:text-blue-400 font-bold disabled:opacity-30 active:opacity-50 transition-all shrink-0"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '發佈'}
        </button>
      </div>

      <div className="max-w-xl mx-auto pt-20 px-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        <form id="create-listing-form" onSubmit={handleSubmit} className="space-y-8">
          {/* Photos Group */}
          <section>
            <h3 className="px-4 text-[13px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">卡片照片</h3>
            <div className="bg-white dark:bg-white/5 rounded-[2rem] p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
              <div className="grid grid-cols-3 gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50 dark:bg-black/20 group ring-1 ring-black/5">
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/40 hover:bg-red-500 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[9px] font-bold text-center py-1 uppercase tracking-tighter">
                        封面圖
                      </div>
                    )}
                  </div>
                ))}
                
                {imageFiles.length < 6 && (
                  <label className="flex flex-col items-center justify-center aspect-[3/4] rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 cursor-pointer transition-all active:scale-95">
                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-2">
                      <Plus className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">新增</span>
                    <input type="file" multiple className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                )}
              </div>
              <p className="mt-4 text-[11px] text-gray-400 text-center">最多可上傳 6 張照片</p>
            </div>
          </section>

          {/* Details Group */}
          <section>
            <h3 className="px-4 text-[13px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">基本資訊</h3>
            <div className="bg-white dark:bg-white/5 rounded-[2rem] overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/5 divide-y divide-gray-100 dark:divide-white/5">
              <div className="flex items-center px-5 py-4">
                <label className="w-24 text-[15px] font-medium text-gray-500 dark:text-gray-400">卡牌名稱</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-[15px] bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-300"
                  placeholder="例如：噴火龍 VMAX SSR"
                />
              </div>
              <div className="flex items-center px-5 py-4">
                <label className="w-24 text-[15px] font-medium text-gray-500 dark:text-gray-400">系列代號</label>
                <input
                  type="text"
                  value={seriesCode}
                  onChange={(e) => setSeriesCode(e.target.value.toUpperCase())}
                  className="flex-1 text-[15px] bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-300 font-mono uppercase"
                  placeholder="例如：SV4A"
                />
              </div>
              <div className="flex items-center px-5 py-4">
                <label className="w-24 text-[15px] font-medium text-gray-500 dark:text-gray-400">卡號碼</label>
                <div className="flex-1 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full text-[15px] bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-300 font-mono"
                    placeholder="201/165"
                  />
                  {seriesCode && cardNumber ? (
                    <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full text-green-700 dark:text-green-400 shrink-0 shadow-sm border border-green-200 dark:border-green-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold tracking-wide">可配對市價</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center px-5 py-4">
                <label className="w-24 text-[15px] font-medium text-gray-500 dark:text-gray-400">售價</label>
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-[15px] font-bold text-blue-600">HK$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="flex-1 text-[15px] bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-gray-300 font-bold"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center px-5 py-4">
                <label className="w-24 text-[15px] font-medium text-gray-500 dark:text-gray-400">評級狀態</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="flex-1 text-[15px] bg-transparent outline-none text-blue-600 dark:text-blue-400 font-semibold appearance-none text-right cursor-pointer"
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Tags & Description Group */}
          <section>
            <h3 className="px-4 text-[13px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">描述與標籤</h3>
            <div className="bg-white dark:bg-white/5 rounded-[2rem] p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 space-y-6">
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white shadow-md active:scale-95'
                        : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 active:scale-95'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-[15px] leading-relaxed bg-gray-50 dark:bg-white/5 p-4 rounded-2xl outline-none text-gray-900 dark:text-white placeholder:text-gray-400 resize-none ring-1 ring-black/5 dark:ring-white/10"
                placeholder="描述卡片的細節、瑕疵或交易方式..."
              />
            </div>
          </section>

          {/* Hidden Action Button for Form Support */}
          <button type="submit" className="hidden" />
        </form>
      </div>
    </div>
  );
};
