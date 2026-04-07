import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  MessageCircle, 
  Wrench, 
  Info, 
  Plus, 
  Search,
  Camera
} from 'lucide-react';
import { cn } from '../lib/utils';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFabMenu, setShowFabMenu] = useState(false);

  const hideOnPaths = [
    '/listing/',
    '/chat/',
    '/create',
    '/create-want',
    '/edit-listing/',
    '/edit-want/',
    '/auth'
  ];

  const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path));

  if (shouldHide) return null;

  const navItems = [
    { icon: ShoppingBag, label: '市集', path: '/' },
    { icon: MessageCircle, label: '消息', path: '/chats' },
    { icon: null, label: '', path: '' }, 
    { icon: Wrench, label: '工具', path: '/portfolio' },
    { icon: Info, label: '資訊', path: '/articles' },
  ];

  const fabOptions = [
    { 
      icon: Search, 
      label: '徵卡區', 
      sublabel: '發佈您的徵求',
      bgColor: 'bg-[#1868f6]', 
      iconBgColor: 'bg-white/20',
      onClick: () => {
        navigate('/create-want');
        setShowFabMenu(false);
      }
    },
    { 
      icon: Camera, 
      label: '上架賣卡', 
      sublabel: '拍下您的收藏',
      bgColor: 'bg-[#f01d24]', 
      iconBgColor: 'bg-white/20',
      onClick: () => {
        navigate('/create');
        setShowFabMenu(false);
      }
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[9999]">
      <AnimatePresence>
        {showFabMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFabMenu(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[101]"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-28 left-4 right-4 z-[102] max-w-sm mx-auto flex gap-4"
            >
              {fabOptions.map((option, idx) => (
                <button
                  key={idx}
                  onClick={option.onClick}
                  className={cn("flex-1 aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-3 shadow-2xl active:scale-[0.98] transition-all group", option.bgColor)}
                >
                  <div className={cn("w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white shadow-sm", option.iconBgColor)}>
                    <option.icon className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-xl text-white tracking-tight">{option.label}</span>
                    <span className="text-xs text-white/90 font-medium">{option.sublabel}</span>
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="relative bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-3xl border-t border-gray-100 dark:border-white/10 px-2 pb-safe">
        <div className="max-w-md mx-auto flex items-center justify-between h-16">
          {navItems.map((item, idx) => {
            if (!item.icon) {
              return (
                <div key={idx} className="relative w-16 h-16 -mt-8">
                  <button
                    onClick={() => setShowFabMenu(!showFabMenu)}
                    className={cn(
                      "absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl active:scale-90 z-10",
                      showFabMenu 
                        ? "bg-white text-black rotate-45" 
                        : "bg-blue-600 text-white shadow-blue-600/40"
                    )}
                  >
                    <Plus className={cn("w-8 h-8 transition-transform duration-500", showFabMenu && "rotate-0")} />
                  </button>
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-20 h-10 bg-white/90 dark:bg-[#0a0a0a]/90 rounded-b-full -z-0" />
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            return (
              <button
                key={idx}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center flex-1 h-full gap-1 group"
              >
                <item.icon 
                  className={cn(
                    "w-5 h-5 transition-all duration-300",
                    isActive 
                    ? "text-blue-600 dark:text-blue-400 scale-110" 
                    : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200"
                  )} 
                />
                <span className={cn(
                  "text-[10px] font-bold transition-all duration-300",
                  isActive 
                    ? "text-blue-600 dark:text-blue-400" 
                    : "text-gray-400"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
