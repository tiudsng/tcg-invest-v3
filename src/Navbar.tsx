import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Camera, MessageCircle, LogOut, User as UserIcon, X, BookOpen, Search, Heart, Sparkles, BadgeDollarSign, Plus, Sun, Moon, ShieldCheck, Home, Scan, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Navbar: React.FC = () => {
  const { user, signInWithGoogle, logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const isDetailView = location.pathname.startsWith('/listing/') || 
                      location.pathname.startsWith('/chat/') ||
                      location.pathname.startsWith('/article/') ||
                      location.pathname.startsWith('/create') ||
                      location.pathname.startsWith('/edit-') ||
                      (location.pathname.startsWith('/profile/') && location.pathname !== '/profile');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleProtectedAction = (e: React.MouseEvent) => {
    if (user?.isGuest) {
      e.preventDefault();
      navigate(`/auth?from=${encodeURIComponent(location.pathname)}`);
    }
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navLinks = [
    { path: '/search', label: '搜尋', icon: Search },
    { path: '/promo-cards', label: 'Promo Cards', icon: Sparkles },
    { path: '/create', label: '賣卡區', icon: Camera, protected: true },
    { path: '/create-want', label: '徵卡區', icon: Sparkles, protected: true },
    { path: '/articles', label: '資訊', icon: BookOpen },
    { path: '/portfolio', label: '投資組合', icon: BadgeDollarSign },
    { path: '/chats', label: '訊息', icon: MessageCircle, protected: true },
  ];

  if (user && !user.isGuest && user.role === 'admin') {
    navLinks.push({ path: '/admin', label: '管理員', icon: ShieldCheck, protected: true });
  }

  return (
    <>
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/10 supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/60"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <div className="flex items-center gap-2">
              {isDetailView && (
                <button
                  onClick={handleBack}
                  className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all active:scale-90"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <Link to="/" className="flex items-center gap-3 group">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6">
                    <rect x="2" y="9" width="10" height="13" rx="1.5" className="fill-white/20 stroke-white/50" strokeWidth="1" />
                    <rect x="6" y="5.5" width="10" height="13" rx="1.5" className="fill-white/40 stroke-white/70" strokeWidth="1" />
                    <rect x="10" y="2" width="10" height="13" rx="1.5" className="fill-white stroke-white" strokeWidth="1.2" />
                    <path d="M18.5 3.5L19 5L20.5 5.5L19 6L18.5 7.5L18 6L16.5 5.5L18 5L18.5 3.5Z" fill="#3b82f6" className="animate-pulse origin-center" />
                  </svg>
                </div>
                <span className="font-black text-lg sm:text-xl tracking-tighter text-gray-900 dark:text-white italic hidden sm:block">TCG INVEST</span>
              </Link>
            </div>

            <div className="hidden lg:flex items-center gap-1 bg-gray-100/50 dark:bg-white/5 p-1.5 rounded-2xl border border-gray-200/50 dark:border-white/5">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={link.protected ? handleProtectedAction : undefined}
                    className={`relative px-3 xl:px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                      active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="desktop-nav-active"
                        className="absolute inset-0 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-gray-200/50 dark:border-white/5"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5 xl:gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="hidden xl:inline">{link.label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                to="/ai-scan"
                className="p-2 sm:p-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all active:scale-95 flex items-center gap-2"
                title="AI 卡牌辨識"
              >
                <Scan className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-bold">AI 辨識</span>
              </Link>
              
              <button
                onClick={toggleTheme}
                className="p-2 sm:p-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              <div className="hidden sm:block h-6 w-px bg-gray-200 dark:bg-gray-800"></div>

              {user && !user.isGuest ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link to="/profile" className="flex items-center gap-3 group p-1 sm:pr-3 bg-transparent sm:bg-gray-50 dark:bg-transparent sm:dark:bg-white/5 rounded-full sm:border border-gray-200/50 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"  referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700">
                        <UserIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 hidden sm:block max-w-[100px] truncate">
                      {user.displayName || 'User'}
                    </span>
                  </Link>
                  <button 
                    onClick={logOut}
                    className="hidden lg:flex p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all active:scale-95"
                    title="登出"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
                >
                  登入 / 註冊
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {showCreateMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateMenu(false)}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-28 left-4 right-4 z-50 lg:hidden"
            >
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 shadow-2xl border border-gray-100 dark:border-white/10 relative overflow-hidden">
                <button 
                  onClick={() => setShowCreateMenu(false)}
                  className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 text-center tracking-tight">選擇發佈類型</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <Link 
                    to="/ai-scan"
                    onClick={() => setShowCreateMenu(false)}
                    className="col-span-2 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95 group mb-2"
                  >
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Scan className="w-7 h-7 text-white" />
                    </div>
                    <span className="font-black text-xl mb-1 tracking-tight">AI 全能發佈</span>
                    <span className="text-xs font-bold text-blue-100 uppercase tracking-widest">拍照即刻識別並上架</span>
                  </Link>

                  <Link 
                    to="/create-want" 
                    onClick={(e) => { handleProtectedAction(e); setShowCreateMenu(false); }}
                    className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all active:scale-95 group"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-base mb-1 tracking-tight">徵卡區</span>
                    <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">發佈您的徵求</span>
                  </Link>
                  
                  <Link 
                    to="/create" 
                    onClick={(e) => { handleProtectedAction(e); setShowCreateMenu(false); }}
                    className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-3xl text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95 group"
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                    <span className="font-black text-base mb-1 tracking-tight">上架賣卡</span>
                    <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">拍下您的收藏</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
