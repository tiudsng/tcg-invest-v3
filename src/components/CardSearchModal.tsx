import React, { useState, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';

interface PokemonCard {
  cardID: string;
  cardThumbFile: string;
  cardNameAltText: string;
  cardNameViewText: string;
}

interface CardSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (card: PokemonCard) => void;
}

export const CardSearchModal: React.FC<CardSearchModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError('');
    }
  }, [isOpen]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/search?keyword=${encodeURIComponent(query)}`);
      if (response.data && response.data.cardList) {
        setResults(response.data.cardList);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Error searching cards:', err);
      setError('搜尋失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#1c1c1e] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-white/10"
        >
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">搜尋官方卡牌資料庫</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-white/10">
            <form onSubmit={handleSearch} className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="輸入寶可夢名稱 (例如: 噴火龍, 皮卡丘)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-black/40 border border-transparent focus:border-blue-500 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-0 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute inset-y-1.5 right-1.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-bold transition-colors flex items-center"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜尋'}
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-[#111]">
            {error && (
              <div className="text-center text-red-500 py-8 font-bold">{error}</div>
            )}
            
            {!loading && !error && results.length === 0 && query && (
              <div className="text-center text-gray-500 py-8">找不到相關卡牌</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map((card) => (
                <div
                  key={card.cardID}
                  onClick={() => onSelect(card)}
                  className="bg-white dark:bg-[#1c1c1e] rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all group"
                >
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-black relative overflow-hidden">
                    <img
                      src={`https://www.pokemon-card.com${card.cardThumbFile}`}
                      alt={card.cardNameViewText}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 text-center">
                      {card.cardNameViewText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
