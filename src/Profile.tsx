import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, Mail, Shield, LogOut, Edit2, Check, X, Camera, Package, Search, Star, Clock, Trophy, Smartphone, Fingerprint, MessageSquare, ThumbsUp, Award, CheckCircle2, Zap } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { cn } from './lib/utils';

const useTrainerRank = (deals: number, rating: number) => {
  return React.useMemo(() => {
    if (deals >= 300 && rating >= 4.9) {
      return { level: 5, title: '聯盟冠軍', wrapperClass: 'p-[4px] bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 animate-pulse drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]', badgeColor: 'bg-gradient-to-r from-yellow-400 to-amber-600', remaining: 0, progress: 100 };
    } else if (deals >= 150 && rating >= 4.8) {
      return { level: 4, title: '四天王', wrapperClass: 'p-[4px] bg-purple-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]', badgeColor: 'bg-purple-500', remaining: 300 - deals, progress: ((deals - 150) / 150) * 100 };
    } else if (deals >= 50 && rating >= 4.5) {
      return { level: 3, title: '精英訓練家', wrapperClass: 'p-[4px] bg-blue-500 drop-shadow-md', badgeColor: 'bg-blue-500', remaining: 150 - deals, progress: ((deals - 50) / 100) * 100 };
    } else if (deals >= 10 && rating >= 4.0) {
      return { level: 2, title: '進階訓練家', wrapperClass: 'p-[3px] bg-green-400', badgeColor: 'bg-green-500', remaining: 50 - deals, progress: ((deals - 10) / 40) * 100 };
    } else {
      return { level: 1, title: '新手訓練家', wrapperClass: 'p-[2px] bg-gray-300 dark:bg-gray-700', badgeColor: 'bg-gray-500', remaining: 10 - deals, progress: (deals / 10) * 100 };
    }
  }, [deals, rating]);
};

export const Profile = () => {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [userListings, setUserListings] = useState<any[]>([]);
  const [nameChanged, setNameChanged] = useState(false);
  const [originalName, setOriginalName] = useState('');

  const AVATAR_PRESETS = [
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Milo&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Lily&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Coco&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/lorelei/svg?seed=Buster&backgroundColor=d1d4f9"
  ];

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
      
      const fetchUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setNameChanged(data.nameChanged || false);
            setOriginalName(data.displayName || user.displayName || '');
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      fetchUserData();

      // Fetch user listings count
      const fetchListings = async () => {
        try {
          const q = query(collection(db, 'listings'), where('sellerId', '==', user.uid));
          const snapshot = await getDocs(q);
          setUserListings(snapshot.docs.map(doc => doc.data()));
        } catch (error) {
          console.error("Error fetching user listings:", error);
        }
      };
      fetchListings();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">尚未登入</h2>
          <p className="text-gray-500 dark:text-gray-400">請登入以查看您的用戶資訊</p>
          <button 
            onClick={() => navigate('/auth')} 
            className="mt-4 bg-[#1868f6] text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
          >
            前往登入
          </button>
        </div>
      </div>
    );
  }

  const handleUpdate = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const updates: any = { photoURL };
      let isNameChanging = false;

      if (displayName !== originalName && !nameChanged) {
        updates.displayName = displayName;
        updates.nameChanged = true;
        isNameChanging = true;
      } else if (!nameChanged) {
        updates.displayName = displayName;
      }

      await updateProfile(auth.currentUser, {
        displayName: updates.displayName || auth.currentUser.displayName,
        photoURL: updates.photoURL
      });
      await updateDoc(doc(db, 'users', user.uid), updates);
      
      if (isNameChanging) {
        setNameChanged(true);
        setOriginalName(displayName);
      }

      setIsEditing(false);
      toast.success('個人資料更新成功！');
      // Reload to refresh the auth context state
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('更新失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate('/');
  };

  const dealsCount = 128; // 模擬真實數據，未來可替換為 userListings.length
  const { level, title: rankTitle, wrapperClass, badgeColor, remaining, progress } = useTrainerRank(dealsCount, user.sellerRating || 4.9);

  const displayAvatar = isEditing ? photoURL : user.photoURL;
  const defaultAvatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.displayName || 'User'}&backgroundColor=e2e8f0`;
  const avatarSrc = displayAvatar || defaultAvatar;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-32 sm:py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Profile Header Card (Left/Center/Right Logic) */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] px-5 pb-6 pt-16 sm:p-8 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col md:flex-row items-center md:items-center gap-6 relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          {/* Left/Top: Avatar + Title */}
          <div className="relative shrink-0 flex flex-col items-center gap-3 z-10">
            {/* Gamified Avatar Layer */}
            <div className={cn("relative rounded-full transition-all duration-500", wrapperClass)}>
              <img 
                src={avatarSrc} 
                alt="Profile" 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white dark:border-[#1c1c1e] object-cover bg-white dark:bg-[#111]"
                referrerPolicy="no-referrer"
              />
              {isEditing && (
                <div className="absolute inset-0 m-1 bg-black/50 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
              {/* Achievement Badge */}
              {!isEditing && (
                <div className={cn("absolute -bottom-2 -right-2 text-white text-[10px] font-black px-3 py-1 rounded-full border-4 border-white dark:border-[#1c1c1e] shadow-md flex items-center gap-1 z-10", badgeColor)}>
                  <Trophy className="w-3 h-3 fill-white" /> Lv.{level}
                </div>
              )}
            </div>
            {!isEditing && (
              <div className={cn("text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md flex items-center gap-1", badgeColor)}>
                <Award className="w-3 h-3 fill-white" /> {rankTitle}
              </div>
            )}
          </div>

          {/* Center: Username + Joined Date */}
          <div className="flex-grow text-center md:text-left z-10 w-full">
            {isEditing ? (
              <div className="space-y-5 w-full max-w-sm mx-auto md:mx-0">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 text-left">選擇頭像</label>
                  <div className="flex gap-3 mb-3 justify-center md:justify-start">
                    {AVATAR_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPhotoURL(preset)}
                        className={cn(
                          "w-12 h-12 rounded-full border-2 overflow-hidden transition-all",
                          photoURL === preset ? "border-[#1868f6] scale-110 shadow-md" : "border-transparent hover:scale-105"
                        )}
                      >
                        <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover bg-gray-100" />
                      </button>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-[#1868f6] outline-none text-gray-900 dark:text-white text-sm"
                    placeholder="或輸入自訂圖片網址 (URL)"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-1">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 text-left">顯示名稱</label>
                    {nameChanged && <span className="text-[10px] text-red-500 font-bold">已修改過，無法再更改</span>}
                  </div>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={nameChanged}
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl outline-none text-gray-900 dark:text-white transition-colors",
                      nameChanged 
                        ? "bg-gray-100 dark:bg-[#222] border-gray-200 dark:border-gray-800 opacity-70 cursor-not-allowed" 
                        : "bg-gray-50 dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#1868f6]"
                    )}
                    placeholder="輸入您的暱稱"
                  />
                  {!nameChanged && <p className="text-[10px] text-gray-500 mt-1 text-left">⚠️ 名字只能修改一次，請謹慎填寫。</p>}
                </div>
                <div className="flex gap-3 pt-2 justify-center md:justify-start">
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(originalName);
                      setPhotoURL(user.photoURL || '');
                    }}
                    className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" /> 取消
                  </button>
                  <button 
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-3 bg-[#1868f6] text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> {loading ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
                  {user.displayName || '匿名用戶'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4 flex items-center justify-center md:justify-start gap-1">
                  加入於 {user.createdAt ? new Date(user.createdAt.seconds ? user.createdAt.seconds * 1000 : user.createdAt).getFullYear() : '2026'} 年
                </p>
                
                {/* Mobile/Visible Edit Button */}
                <div className="flex justify-center md:justify-start mb-6">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#222] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Edit2 className="w-4 h-4" /> 編輯個人資料
                  </button>
                </div>

                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    <Smartphone className="w-3 h-3" /> 手機認證
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    <Fingerprint className="w-3 h-3" /> 實名認證
                  </div>
                </div>

                {/* Gamification Progress Bar */}
                {!isEditing && level < 5 && (
                  <div className="w-full max-w-xs mx-auto md:mx-0 bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-gray-500 dark:text-gray-400">距離解鎖 <span className="text-gray-900 dark:text-white">Lv.{level + 1}</span></span>
                      <span className="text-gray-900 dark:text-white">還差 {remaining} 筆好評</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className={cn("h-full rounded-full", badgeColor)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right/Bottom: Trust Score & Interaction */}
          {!isEditing && (
            <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto z-10">
              {/* Score Card */}
              <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl p-4 flex flex-col items-center md:items-end border border-gray-100 dark:border-white/5">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{(user.sellerRating || 4.9).toFixed(1)}</span>
                  <span className="text-sm font-bold text-gray-400">/ 5.0</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-gray-500">(120+ 評價)</span>
                </div>
              </div>

              {/* Interaction Card */}
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-2xl p-4 flex flex-col items-center md:items-end border border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-sm mb-1">
                  <Zap className="w-4 h-4 fill-blue-600 dark:fill-blue-400" /> 回覆速度：極快
                </div>
                <div className="text-xs font-medium text-blue-500/80 dark:text-blue-400/80">
                  平均 1 小時內
                </div>
              </div>
            </div>
          )}

          {/* Edit/Logout Buttons (Top Right - Desktop mainly, but keep logout for mobile) */}
          {!isEditing && (
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-1 z-20 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-full p-1 shadow-sm border border-gray-200 dark:border-white/10">
              <button onClick={handleLogout} className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex items-center gap-2 px-3">
                <LogOut className="w-4 h-4" /> <span className="text-xs font-bold hidden sm:inline">登出</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Review Tags */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 sm:p-8 border border-gray-100 dark:border-white/5 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">買家評價標籤</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">📦 包裝嚴密</span>
                <span className="text-xs font-black text-gray-400 bg-white dark:bg-[#222] px-2 py-1 rounded-lg shadow-sm">42</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">✨ 卡況如圖</span>
                <span className="text-xs font-black text-gray-400 bg-white dark:bg-[#222] px-2 py-1 rounded-lg shadow-sm">38</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-2xl">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">🤝 交收準時</span>
                <span className="text-xs font-black text-gray-400 bg-white dark:bg-[#222] px-2 py-1 rounded-lg shadow-sm">56</span>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="flex flex-col gap-4">
            <button onClick={() => navigate('/')} className="flex-1 flex items-center gap-4 p-6 rounded-[2rem] bg-white dark:bg-[#1c1c1e] hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border border-gray-100 dark:border-white/5 shadow-sm group">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Package className="w-7 h-7" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">我的賣場</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">管理您上架的卡牌與訂單</p>
              </div>
            </button>

            <button onClick={() => navigate('/')} className="flex-1 flex items-center gap-4 p-6 rounded-[2rem] bg-white dark:bg-[#1c1c1e] hover:bg-gray-50 dark:hover:bg-[#222] transition-colors border border-gray-100 dark:border-white/5 shadow-sm group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Search className="w-7 h-7" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-gray-900 dark:text-white">我的徵卡</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">查看與編輯您的徵收需求</p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
