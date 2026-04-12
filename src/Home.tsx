import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, where, doc, setDoc, arrayUnion, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { Listing, WantListing, PortfolioItem } from './types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { Search, BookOpen, ChevronRight, ChevronLeft, Clock, ShoppingBag, PlusCircle, Camera, Star, Repeat, Calendar, Filter, X, Image as ImageIcon, Briefcase, Loader2, RefreshCw, TrendingUp, Zap, Pencil, Flame, Sparkles } from 'lucide-react';
import { ARTICLES } from './articleData';
import { useAuth } from './AuthContext';
import { ConditionBadge } from './components/ConditionBadge';
import { FavoriteButton } from './components/FavoriteButton';
import { SellerBadge } from './components/SellerBadge';
import { PriceLeaderboard } from './components/PriceLeaderboard';
import { cn } from './lib/utils';

const ListingSkeleton = () => (
  <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 h-full animate-pulse">
    <div className="aspect-[3/4] w-full bg-gray-100 dark:bg-black" />
    <div className="p-2.5 sm:p-5 space-y-3">
      <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-3/4" />
      <div className="h-6 bg-gray-100 dark:bg-white/5 rounded w-1/2" />
      <div className="pt-2 sm:pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 sm:w-6 sm:h-6 bg-gray-100 dark:bg-white/5 rounded-full" />
          <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-16" />
        </div>
      </div>
    </div>
  </div>
);

const ArticleSkeleton = () => (
  <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 flex flex-col h-full w-[90vw] sm:minw-[350px] sm:w-auto snap-center shrink-0 animate-pulse">
    <div className="h-56 sm:h-48 w-full bg-gray-100 dark:bg-black" />
    <div className="p-6 flex flex-col flex-grow space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-16" />
        <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-16" />
      </div>
      <div className="h-6 bg-gray-100 dark:bg-white/5 rounded w-full" />
      <div className="h-6 bg-gray-100 dark:bg-white/5 rounded w-2/3" />
      <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full mt-4" />
      <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-4/5" />
    </div>
  </div>
);

const FeaturedArticle = ({ article, isLarge = false, onEdit }: { article: any, isLarge?: boolean, onEdit?: (id: string, url: string) => void }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="group relative flex flex-col sm:block w-full h-full bg-[#111111] sm:bg-[#1c1c1e] rounded-2xl sm:rounded-[1.5rem] overflow-hidden border border-gray-800 sm:border-white/5 transition-all duration-300 hover:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-1">
      <Link to={`/article/${article.id}`} className="absolute inset-0 z-10" aria-label={`閱讀 ${article.title}`} />
      <div className={`relative w-full ${isLarge ? 'aspect-[21/9]' : 'aspect-[4/3]'} sm:aspect-auto sm:h-full sm:min-h-[200px] overflow-hidden z-0 shrink-0`}>
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" 
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/800/600?blur=2`;
          }}
        />
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
      </div>
      <div className="p-3 sm:absolute sm:bottom-0 sm:left-0 sm:right-0 sm:p-6 z-0 pointer-events-none flex flex-col justify-start sm:justify-end flex-grow">
        <h3 className={`${isLarge ? 'text-[15px] sm:text-3xl' : 'text-[12px] sm:text-xl'} font-bold sm:font-semibold tracking-tight text-white line-clamp-2 group-hover:text-blue-400 transition-colors leading-tight sm:leading-snug mb-1 sm:mb-2`}>
          {article.title}
        </h3>
        {article.readTime && (
          <div className="flex items-center gap-1 text-[10px] sm:text-sm text-gray-400 sm:text-gray-300 font-medium mt-auto sm:mt-0">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{article.readTime}</span>
            {article.date && <span className="truncate"> · {article.date}</span>}
          </div>
        )}
      </div>
      {isAdmin && (
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newUrl = window.prompt("請輸入新的封面圖片 URL:", article.imageUrl);
            if (newUrl && newUrl !== article.imageUrl) {
              try {
                await setDoc(doc(db, 'articles', article.id), { imageUrl: newUrl }, { merge: true });
                if (onEdit) onEdit(article.id, newUrl);
                toast.success("封面圖片更新成功！");
              } catch (error) {
                console.error("Error updating cover image:", error);
                toast.error("更新失敗，請稍後再試。");
              }
            }
          }}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white transition-colors z-20"
          title="編輯封面"
        >
          <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      )}
    </div>
  );
};

const ListArticle = ({ article, onEdit }: { article: any, onEdit?: (id: string, url: string) => void }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="group relative block w-full bg-[#1c1c1e] rounded-[1.25rem] sm:rounded-[1.5rem] overflow-hidden border border-white/5 p-2.5 sm:p-3 transition-all duration-300 hover:border-white/10">
      <Link to={`/article/${article.id}`} className="absolute inset-0 z-10" aria-label={`閱讀 ${article.title}`} />
      <div className="flex gap-3 sm:gap-4 relative z-0 pointer-events-none">
        <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0">
          <img 
            src={article.imageUrl} 
            alt={article.title} 
            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/400/400?blur=1`;
            }}
          />
        </div>
        <div className="flex flex-col justify-center py-0.5 flex-1">
          {article.date && (
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 mb-1">
              <Clock className="w-3 h-3" />
              <span>{article.date}</span>
            </div>
          )}
          <h3 className="text-[13px] sm:text-base font-bold text-white line-clamp-2 group-hover:text-blue-400 transition-colors leading-snug mb-1">
            {article.title}
          </h3>
          {article.readTime && (
            <div className="text-[10px] sm:text-xs text-gray-500">
              {article.readTime}
            </div>
          )}
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newUrl = window.prompt("請輸入新的封面圖片 URL:", article.imageUrl);
            if (newUrl && newUrl !== article.imageUrl) {
              try {
                await setDoc(doc(db, 'articles', article.id), { imageUrl: newUrl }, { merge: true });
                if (onEdit) onEdit(article.id, newUrl);
                toast.success("封面圖片更新成功！");
              } catch (error) {
                console.error("Error updating cover image:", error);
                toast.error("更新失敗，請稍後再試。");
              }
            }
          }}
          className="absolute top-3 right-3 p-1.5 sm:p-2 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white transition-colors z-20"
          title="編輯封面"
        >
          <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      )}
    </div>
  );
};

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [localArticles, setLocalArticles] = useState<any[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [wantListings, setWantListings] = useState<WantListing[]>([]);
  const [lastListingDoc, setLastListingDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastWantDoc, setLastWantDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [hasMoreWants, setHasMoreWants] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFetchingMoreWants, setIsFetchingMoreWants] = useState(false);
  const [activeTab, setActiveTab] = useState<'sell' | 'want'>('sell');
  const [loading, setLoading] = useState(true);
  const [loadingWants, setLoadingWants] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    conditions: [] as string[],
    cardTypes: [] as string[],
    minPrice: '',
    maxPrice: ''
  });

  const handleProtectedAction = (e: React.MouseEvent) => {
    if (!user || user.isGuest) {
      e.preventDefault();
      navigate('/auth');
    }
  };

  const fetchListings = React.useCallback(async (isInitial = false) => {
    if (!isInitial && (isFetchingMore || loading)) return;
    if (isInitial) setLoading(true);
    else setIsFetchingMore(true);

    try {
      let q = query(
        collection(db, 'listings'),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (!isInitial && lastListingDoc) {
        q = query(q, startAfter(lastListingDoc));
      }

      const snapshot = await getDocs(q);
      const fetchedListings = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Listing[];

      if (isInitial) {
        setListings(fetchedListings);
      } else {
        setListings(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueNew = fetchedListings.filter(l => !existingIds.has(l.id));
          return [...prev, ...uniqueNew];
        });
      }

      setLastListingDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreListings(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [lastListingDoc]);

  const fetchWants = React.useCallback(async (isInitial = false) => {
    if (!isInitial && (isFetchingMoreWants || loadingWants)) return;
    if (isInitial) setLoadingWants(true);
    else setIsFetchingMoreWants(true);

    try {
      let q = query(
        collection(db, 'wantListings'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      if (!isInitial && lastWantDoc) {
        q = query(q, startAfter(lastWantDoc));
      }

      const snapshot = await getDocs(q);
      const fetchedWants = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WantListing[];

      if (isInitial) {
        setWantListings(fetchedWants);
      } else {
        setWantListings(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueNew = fetchedWants.filter(l => !existingIds.has(l.id));
          return [...prev, ...uniqueNew];
        });
      }

      setLastWantDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreWants(snapshot.docs.length === 20);
    } catch (error) {
      console.error("Error fetching want listings:", error);
    } finally {
      setLoadingWants(false);
      setIsFetchingMoreWants(false);
    }
  }, [lastWantDoc]);

  const handleArticleEdit = (id: string, newUrl: string) => {
    setLocalArticles(prev => prev.map(a => a.id === id ? { ...a, imageUrl: newUrl } : a));
  };

  const fetchArticles = React.useCallback(async () => {
    try {
      const q = query(collection(db, 'articles'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const dbArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Merge static articles with DB articles, avoiding duplicates by ID
      const merged = [...dbArticles];
      ARTICLES.forEach(staticArt => {
        if (!merged.find(a => a.id === staticArt.id)) {
          merged.push(staticArt);
        }
      });

      // Sort all articles by createdAt desc
      merged.sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setLocalArticles(merged);
    } catch (error) {
      console.error("Error fetching articles:", error);
      setLocalArticles(ARTICLES);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
    fetchListings(true);
    fetchWants(true);
  }, []);

  const isFiltering = searchQuery.length > 0 || filters.conditions.length > 0 || filters.cardTypes.length > 0 || filters.minPrice !== '' || filters.maxPrice !== '';

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = React.useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingWants || isFetchingMore || isFetchingMoreWants || isFiltering) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (activeTab === 'sell' && hasMoreListings) {
          fetchListings();
        } else if (activeTab === 'want' && hasMoreWants) {
          fetchWants();
        }
      }
    }, { threshold: 0.1 });

    if (node) observer.current.observe(node);
  }, [loading, loadingWants, isFetchingMore, isFetchingMoreWants, isFiltering, activeTab, hasMoreListings, hasMoreWants, fetchListings, fetchWants]);

  const filteredListings = React.useMemo(() => listings.filter(listing => {
    const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (listing.englishName && listing.englishName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         listing.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCondition = filters.conditions.length === 0 || filters.conditions.includes(listing.condition);
    const matchesCardType = filters.cardTypes.length === 0 || (listing.cardType && filters.cardTypes.includes(listing.cardType));
    
    const price = listing.price;
    const matchesMinPrice = !filters.minPrice || price >= parseFloat(filters.minPrice);
    const matchesMaxPrice = !filters.maxPrice || price <= parseFloat(filters.maxPrice);

    return matchesSearch && matchesCondition && matchesCardType && matchesMinPrice && matchesMaxPrice;
  }), [listings, searchQuery, filters]);

  const filteredWantListings = React.useMemo(() => wantListings.filter(listing => {
    const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (listing.englishName && listing.englishName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCondition = filters.conditions.length === 0 || filters.conditions.includes(listing.condition || 'Mint');
    const matchesCardType = filters.cardTypes.length === 0 || (listing.cardType && filters.cardTypes.includes(listing.cardType));
    
    const price = listing.targetPrice;
    const matchesMinPrice = !filters.minPrice || price >= parseFloat(filters.minPrice);
    const matchesMaxPrice = !filters.maxPrice || price <= parseFloat(filters.maxPrice);

    return matchesSearch && matchesCondition && matchesCardType && matchesMinPrice && matchesMaxPrice;
  }), [wantListings, searchQuery, filters]);

  const toggleFilter = (type: 'conditions' | 'cardTypes', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      conditions: [],
      cardTypes: [],
      minPrice: '',
      maxPrice: ''
    });
  };

  const activeFilterCount = filters.conditions.length + filters.cardTypes.length + (filters.minPrice ? 1 : 0) + (filters.maxPrice ? 1 : 0);

  return (
    <div className="pt-24 sm:pt-32 pb-12 px-4 sm:px-8 lg:px-12 max-w-[1600px] mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 sm:mb-16 gap-6 sm:gap-8">
        <div className="flex w-full gap-3">
          <div className="relative flex-grow md:w-[500px]">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="搜尋噴火龍、皮卡丘..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-14 pr-6 py-4.5 bg-gray-100/80 dark:bg-white/5 border-0 rounded-[1.5rem] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-white/10 transition-all shadow-sm text-base"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 py-4.5 rounded-[1.5rem] border transition-all flex items-center gap-3 font-bold ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-[#1c1c1e] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20'
            }`}
          >
            <Filter className="w-6 h-6" />
            <span className="hidden sm:inline">篩選</span>
            {activeFilterCount > 0 && (
              <span className="bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6"
        >
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-1">已套用:</span>
          {filters.conditions.map(cond => (
            <button
              key={`chip-cond-${cond}`}
              onClick={() => toggleFilter('conditions', cond)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {cond === 'Mint' ? '美品' : cond}
              <X className="w-3 h-3" />
            </button>
          ))}
          {filters.cardTypes.map(type => (
            <button
              key={`chip-type-${type}`}
              onClick={() => toggleFilter('cardTypes', type)}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold border border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              {type}
              <X className="w-3 h-3" />
            </button>
          ))}
          <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 transition-colors">清除全部</button>
        </motion.div>
      )}

      <motion.div
        initial={false}
        animate={{ 
          height: showFilters ? 'auto' : 0, 
          opacity: showFilters ? 1 : 0,
          marginBottom: showFilters ? (window.innerWidth < 640 ? 16 : 32) : 0 
        }}
        className="overflow-hidden"
      >
        <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-5 sm:p-8 border border-gray-100 dark:border-white/5 shadow-sm space-y-6 sm:space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">篩選條件</h3>
            <button onClick={clearFilters} className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400">清除全部</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">卡片狀態</h4>
              <div className="flex flex-wrap gap-2">
                {['Mint', 'Near Mint', 'Excellent', 'Good', 'Lightly Played', 'Played', 'Poor'].map((cond) => (
                  <button
                    key={cond}
                    onClick={() => toggleFilter('conditions', cond)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      filters.conditions.includes(cond)
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                        : 'bg-white dark:bg-black/20 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {cond === 'Mint' ? '美品' : cond}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">卡片類型</h4>
              <div className="flex flex-wrap gap-2">
                {['RAW', 'PSA 10', 'PSA 9', 'PSA 8', 'BGS', 'CGC'].map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleFilter('cardTypes', type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${
                      filters.cardTypes.includes(type)
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white dark:bg-black/20 border-gray-100 dark:border-white/5 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">價格範圍 (HKD)</h4>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="最低"
                  value={filters.minPrice}
                  onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-white/5 rounded-xl text-sm text-gray-900 dark:text-white outline-none"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="number"
                  placeholder="最高"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-black/40 border border-gray-100 dark:border-white/5 rounded-xl text-sm text-gray-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <PriceLeaderboard />

      <div className="mb-12 sm:mb-20">
        <div className="flex items-center justify-between mb-4 sm:mb-10">
          <h2 className="text-xl sm:text-3xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3 tracking-tight">
            <BookOpen className="w-5 h-5 sm:w-8 sm:h-8 text-blue-600" />
            收藏家指南 🚀
          </h2>
          <Link to="/articles" className="text-sm sm:text-lg text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:gap-2 transition-all">
            查看全部 <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 max-w-6xl mx-auto w-full">
          {loading ? (
            [...Array(3)].map((_, i) => <ArticleSkeleton key={i} />)
          ) : (
            <>
              {/* 文章 1 區 (Featured) - 佔據左側兩欄 */}
              <div className="lg:col-span-2 h-full">
                {localArticles
                  .filter(a => a.zone === 1 || (a.featured && !a.zone))
                  .slice(0, 1)
                  .map(article => (
                    <div key={article.id} className="h-full">
                      <FeaturedArticle article={article} isLarge onEdit={handleArticleEdit} />
                    </div>
                  ))
                }
              </div>
              
              {/* 文章 2 區 & 3 區 - 佔據右側一欄，垂直堆疊 */}
              <div className="lg:col-span-1 grid grid-cols-2 lg:flex lg:flex-col gap-3 sm:gap-6 h-full">
                {localArticles.filter(a => a.zone === 2).slice(0, 1).map(article => (
                  <div key={article.id} className="flex-1">
                    <FeaturedArticle article={article} onEdit={handleArticleEdit} />
                  </div>
                ))}
                {localArticles.filter(a => a.zone === 3).slice(0, 1).map(article => (
                  <div key={article.id} className="flex-1">
                    <FeaturedArticle article={article} onEdit={handleArticleEdit} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 sm:mb-10 scroll-mt-32" id="listings-section">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">最新上架</h2>
        <div className="flex bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl border border-transparent dark:border-white/5 shadow-inner">
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-6 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all ${
              activeTab === 'sell'
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            賣卡區
          </button>
          <button
            onClick={() => setActiveTab('want')}
            className={`px-6 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all ${
              activeTab === 'want'
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            徵卡區
          </button>
        </div>
      </div>

      {activeTab === 'sell' ? (
        loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
            {[...Array(10)].map((_, i) => <ListingSkeleton key={i} />)}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-32 bg-gray-50 dark:bg-gray-800/20 rounded-[3rem] border border-gray-100 dark:border-white/5">
            <Search className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">找不到卡片</h3>
            <button onClick={clearFilters} className="text-blue-600 font-semibold text-lg">清除所有篩選</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
            {filteredListings.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index % 20 * 0.05, duration: 0.5 }}
                ref={index === filteredListings.length - 1 ? lastElementRef : null}
              >
                <div onClick={() => navigate(`/listing/${listing.id}`)} className="group block h-full cursor-pointer">
                  <div className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 h-full flex flex-col">
                    <div className="aspect-[3/4] w-full overflow-hidden bg-gray-100 dark:bg-black relative">
                      <img 
                        src={listing.imageUrl} 
                        alt={listing.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer" 
                        loading="lazy" 
                        decoding="async" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${listing.id}/600/800`;
                        }}
                      />
                      {listing.imageUrls && listing.imageUrls.length > 1 && (
                        <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-xl text-xs font-bold text-white flex items-center gap-1.5 z-10">
                          <ImageIcon className="w-4 h-4" />
                          <span>{listing.imageUrls.length}</span>
                        </div>
                      )}
                      <ConditionBadge condition={listing.condition} cardType={listing.cardType} title={listing.title} className="absolute top-2 right-2 sm:top-4 sm:right-4 !h-7 sm:!h-10 shadow-lg" />
                      <FavoriteButton listingId={listing.id} className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20" />
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col flex-grow">
                      <h3 className="text-sm sm:text-xl font-bold text-gray-900 dark:text-white line-clamp-1 mb-1 sm:mb-2 group-hover:text-blue-600 transition-colors">{listing.title}</h3>
                      <p className="text-lg sm:text-3xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-6 tracking-tight">
                        HK${(listing.price * 7.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <div className="mt-auto pt-4 sm:pt-6 border-t border-gray-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-3 truncate">
                            {listing.sellerPhoto ? (
                              <img src={listing.sellerPhoto} alt={listing.sellerName} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-200 dark:border-gray-800" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-white/10 rounded-full" />
                            )}
                            <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-400 truncate">{listing.sellerName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <span className="font-semibold text-gray-900 dark:text-white">{(listing.sellerRating || 5).toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {isFetchingMore && <div className="col-span-full flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>}
          </div>
        )
      ) : (
        loadingWants ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-8 border border-gray-100 dark:border-white/5 animate-pulse h-40" />)}
          </div>
        ) : filteredWantListings.length === 0 ? (
          <div className="text-center py-32 bg-gray-50 dark:bg-gray-800/20 rounded-[3rem] border border-gray-100 dark:border-white/5">
            <Search className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">找不到徵卡項目</h3>
            <button onClick={clearFilters} className="text-blue-600 font-semibold text-lg">清除所有篩選</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8">
            {filteredWantListings.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index % 20 * 0.05, duration: 0.5 }}
                ref={index === filteredWantListings.length - 1 ? lastElementRef : null}
                className="bg-white dark:bg-[#1c1c1e] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col h-full hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
              >
                <div className="flex items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                  {listing.imageUrl ? (
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-gray-200 dark:border-white/10 shadow-md">
                      <img 
                        src={listing.imageUrl} 
                        alt={listing.title} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${listing.id}/300/300`;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gray-50 dark:bg-black/20 flex items-center justify-center shrink-0 border border-dashed border-gray-300 dark:border-gray-700">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <ConditionBadge condition={listing.condition || 'Mint'} cardType={listing.cardType} title={listing.title} className="!px-3 !py-1 !text-[10px] !h-auto shadow-sm" />
                    </div>
                    <h3 className="text-base sm:text-2xl font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 tracking-tight">{listing.title}</h3>
                    <p className="text-xl sm:text-3xl font-semibold text-blue-600 dark:text-blue-400 tracking-tight">
                      預算 HK${(listing.targetPrice * 7.8).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="mt-auto pt-4 sm:pt-6 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {listing.userPhoto ? (
                      <img src={listing.userPhoto} alt={listing.userName} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-200 dark:border-gray-800" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-white/10 rounded-full" />
                    )}
                    <span className="text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 truncate max-w-[120px]">{listing.userName}</span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {listing.createdAt ? (
                      typeof listing.createdAt.toDate === 'function'
                        ? new Date(listing.createdAt.toDate()).toLocaleDateString()
                        : new Date(listing.createdAt).toLocaleDateString()
                    ) : ''}
                  </span>
                </div>
              </motion.div>
            ))}
            {isFetchingMoreWants && <div className="col-span-full flex justify-center py-12"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>}
          </div>
        )
      )}
    </div>
  );
};
