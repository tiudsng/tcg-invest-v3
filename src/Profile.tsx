import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, Mail, Shield, LogOut, Edit2, Check, X, Camera, Package, Search } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const Profile = () => {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
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
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL
      });
      await updateDoc(doc(db, 'users', user.uid), {
        displayName,
        photoURL
      });
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#111] rounded-[2rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden"
      >
        {/* Header / Cover */}
        <div className="h-32 sm:h-48 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Profile Info */}
        <div className="px-6 sm:px-10 pb-10 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-8">
            <div className="relative group">
              {photoURL || user.photoURL ? (
                <img 
                  src={isEditing ? photoURL : (user.photoURL || '')} 
                  alt="Profile" 
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white dark:border-[#111] object-cover bg-white dark:bg-[#111] shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white dark:border-[#111] bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-lg">
                  <User className="w-16 h-16 text-gray-400" />
                </div>
              )}
              
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center border-4 border-transparent">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  編輯個人資料
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(user.displayName || '');
                      setPhotoURL(user.photoURL || '');
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    取消
                  </button>
                  <button 
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#1868f6] text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {loading ? '儲存中...' : '儲存'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">顯示名稱</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-[#1868f6] outline-none text-gray-900 dark:text-white"
                    placeholder="輸入您的暱稱"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">頭像網址 (URL)</label>
                  <input 
                    type="text" 
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-[#1868f6] outline-none text-gray-900 dark:text-white"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  {user.displayName || '匿名用戶'}
                  {user.role === 'admin' && (
                    <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                      <Shield className="w-3 h-3" /> 管理員
                    </span>
                  )}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
              </div>
            )}

            <div className="pt-8 border-t border-gray-100 dark:border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => navigate('/')} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#222] transition-colors border border-gray-100 dark:border-white/5 group">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 dark:text-white">我的賣場</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">管理您上架的卡牌</p>
                </div>
              </button>

              <button onClick={() => navigate('/')} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#222] transition-colors border border-gray-100 dark:border-white/5 group">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                  <Search className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-gray-900 dark:text-white">我的徵卡</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">查看您的徵收需求</p>
                </div>
              </button>
            </div>

            <div className="pt-8">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                登出帳號
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
