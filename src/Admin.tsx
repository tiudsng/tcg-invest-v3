import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { 
  Shield, 
  Users, 
  Package, 
  AlertTriangle, 
  Search, 
  ChevronRight, 
  Trash2, 
  CheckCircle,
  BarChart3,
  Settings as SettingsIcon,
  ArrowLeft
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    totalWants: 0
  });
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Security check: Only allow specific admin email
  const isAdmin = user?.email === 'appleyes516@gmail.com';

  useEffect(() => {
    if (!isAdmin && user !== undefined) {
      navigate('/');
      return;
    }

    const fetchStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const listingsSnap = await getDocs(collection(db, 'listings'));
        const wantsSnap = await getDocs(collection(db, 'wants'));

        setStats({
          totalUsers: usersSnap.size,
          totalListings: listingsSnap.size,
          totalWants: wantsSnap.size
        });

        const recentQuery = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(5));
        const recentSnap = await getDocs(recentQuery);
        setRecentListings(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin, user, navigate]);

  const handleDeleteListing = async (id: string) => {
    if (!window.confirm('確定要刪除此商品嗎？')) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
      setRecentListings(prev => prev.filter(item => item.id !== id));
      toast.success('商品已刪除');
    } catch (error) {
      toast.error('刪除失敗');
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pt-6 pb-32 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-500" /> 管理後台
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">管理網站數據與內容</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> 系統運行正常
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總用戶數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-3/4 rounded-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總商品數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalListings}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-1/2 rounded-full" />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">總徵卡數</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalWants}</p>
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 w-1/4 rounded-full" />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" /> 最近上架
            </h2>
            <button className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline">查看全部</button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : recentListings.length === 0 ? (
              <div className="p-12 text-center text-gray-500">暫無數據</div>
            ) : (
              recentListings.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-4">
                    <img 
                      src={item.imageUrl} 
                      alt={item.title} 
                      className="w-12 h-12 rounded-xl object-cover bg-gray-100"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-gray-500">HK$ {item.price} • {item.sellerName || '未知賣家'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => navigate(`/listing/${item.id}`)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteListing(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Settings Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> 系統配置
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Gemini AI API</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Firebase Firestore</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-xl">
                <span className="text-sm font-bold">Firebase Auth</span>
                <span className="text-xs font-black text-green-500">已連接</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1c1c1e] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> 安全提示
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              管理後台僅限管理員訪問。請確保您的 API 金鑰已在系統設置中正確配置。
              所有刪除操作均不可逆，請謹慎操作。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
