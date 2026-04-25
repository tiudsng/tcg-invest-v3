import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Search as SearchIcon, ArrowRight, Loader2, Package, Tag, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
import { Product, Listing } from './types';
import { getHighResImage, handleImageError } from './lib/imageUtils';
import { ImageCarousel } from './components/ImageCarousel';
import { ConditionBadge } from './components/ConditionBadge';

export const Search = () => {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [listingResults, setListingResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (queryStr: string) => {
    if (!queryStr.trim()) return;

    setLoading(true);
    setHasSearched(true);
    
    try {
      // 1. Search in products collection by card_number (Exact match)
      const productQuery = query(
        collection(db, 'products'),
        where('card_number', '==', queryStr.trim())
      );
      
      const listingsSnap = await getDocs(collection(db, 'listings'));
      const filteredListings = listingsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Listing))
        .filter(l => 
          l.title.toLowerCase().includes(queryStr.toLowerCase()) ||
          (l.englishName && l.englishName.toLowerCase().includes(queryStr.toLowerCase())) ||
          (l.cardNumber && l.cardNumber.toLowerCase().includes(queryStr.toLowerCase()))
        );

      const productsSnap = await getDocs(productQuery);
      const fetchedProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

      if (fetchedProducts.length === 0) {
        const allProductsSnap = await getDocs(query(collection(db, 'products'), limit(100)));
        const filteredProducts = allProductsSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => 
            p.name_zh.toLowerCase().includes(queryStr.toLowerCase()) ||
            p.name_jp.toLowerCase().includes(queryStr.toLowerCase()) ||
            (p.card_number && p.card_number.toLowerCase().includes(queryStr.toLowerCase()))
          );
        setProductResults(filteredProducts);
      } else {
        setProductResults(fetchedProducts);
      }

      setListingResults(filteredListings);
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
      handleSearch(q);
    }
  }, [searchParams, handleSearch]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black pt-28 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-6">全域搜尋</h1>
          <form onSubmit={onFormSubmit} className="relative max-w-2xl">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <SearchIcon className="h-6 w-6 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="輸入卡號 查詢最新市價及尋找心儀卡片 (例如: 123/456)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-14 pr-32 py-5 bg-gray-100 dark:bg-white/5 border-0 rounded-3xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 transition-all font-medium text-lg"
            />
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="absolute inset-y-2 right-2 px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-2xl font-black transition-all flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜尋'}
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 font-bold">正在檢索資料庫...</p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Products from Catalog */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600">
                  <Package className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">官方目錄結果 ({productResults.length})</h2>
              </div>

              {productResults.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {productResults.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-[#111] rounded-[2rem] overflow-hidden border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all group"
                    >
                      <Link to={`/product/${product.card_id || product.id}`} className="block relative aspect-[3/4] p-3 overflow-hidden">
                        <img 
                          src={getHighResImage(product.image_url, product.name_zh, `${product.set_name}|${product.card_number}`, product.id) || `https://placehold.co/600x840/111/d4af37?text=${encodeURIComponent(product.name_zh || '')}`} 
                          alt={product.name_zh}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, product.image_url, product.name_zh, `${product.set_name}|${product.card_number}`)}
                        />
                        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-tighter">
                          {product.card_number || 'N/A'}
                        </div>
                      </Link>
                      <div className="p-5">
                        <h3 className="font-black text-gray-900 dark:text-white line-clamp-1 mb-1">{product.name_zh}</h3>
                        <p className="text-xs font-bold text-gray-400 mb-3">{product.name_jp}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-blue-600 dark:text-blue-400 font-black text-sm">
                            HK$ {product.market_data?.snkrdunk_price?.toLocaleString()}
                          </span>
                          <Link to={`/product/${product.id}`} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full text-gray-400 hover:text-blue-600 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : hasSearched && (
                <div className="py-12 bg-gray-50 dark:bg-white/5 rounded-3xl text-center">
                  <p className="text-gray-400 font-bold">目錄中找不到相關卡片</p>
                </div>
              )}
            </section>

            {/* Listings from Users */}
            <section>
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-xl text-purple-600">
                  <Tag className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">市集掛單結果 ({listingResults.length})</h2>
              </div>

              {listingResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {listingResults.map((listing) => (
                    <Link 
                      key={listing.id} 
                      to={`/listing/${listing.id}`}
                      className="group bg-white dark:bg-[#111] p-4 rounded-[2.5rem] flex gap-6 border border-gray-100 dark:border-white/5 hover:border-blue-500 transition-all shadow-sm"
                    >
                      <div className="w-32 aspect-[3/4] bg-gray-100 dark:bg-black rounded-2xl overflow-hidden shrink-0 relative">
                        <ImageCarousel 
                          images={listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls : (listing.imageUrl ? [listing.imageUrl] : [])} 
                          title={listing.title} 
                          id={listing.id} 
                          showArrows={false}
                          showImageCount={false}
                        />
                      </div>
                      <div className="flex flex-col justify-between py-2 flex-grow">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white line-clamp-1 flex-1">{listing.title}</h3>
                            <ConditionBadge condition={listing.condition} cardType={listing.cardType} title={listing.title} className="shadow-none ml-2" />
                          </div>
                          <div className="flex items-center gap-4 text-xs font-bold text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              24h ago
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between items-end">
                          <div className="flex flex-wrap items-center gap-2 max-w-[70%]">
                            <span className="text-xl font-black text-blue-600 dark:text-blue-400 truncate max-w-full">
                              HK$ {listing.price.toLocaleString()}
                            </span>
                          </div>
                          <span className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shrink-0">
                            查看詳情
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : hasSearched && (
                <div className="py-12 bg-gray-50 dark:bg-white/5 rounded-3xl text-center">
                  <p className="text-gray-400 font-bold">市集中找不到相關掛單</p>
                </div>
              )}
            </section>
          </div>
        )}

        {!hasSearched && (
          <div className="py-32 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-8">
              <SearchIcon className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">查詢最新市價及尋找心儀卡片</h3>
            <p className="max-w-md text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              您可以輸入寶可夢名稱、由官方資料庫提供的卡號 (如 123/456)，或是任何關鍵字來查詢最新卡市價及尋找心儀卡片。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
