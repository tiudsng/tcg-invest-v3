import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { getHighResImage, getImageClass } from './lib/imageUtils';

export const Cards = () => {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const q = query(collection(db, 'pokeca_gold'), orderBy('rank', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        const fetchedCards = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCards(fetchedCards);
      } catch (err) {
        console.error('Error fetching cards:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f7] pt-28 pb-32 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter"
          >
            POKECA GOLD
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 font-medium tracking-tight"
          >
            Explore the most valuable Pokemon cards
          </motion.p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-8">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[63/88] bg-[#111] animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 mt-8">
            {cards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/card/${card.id}`)}
                className="group cursor-pointer flex flex-col items-center"
              >
                <div className="w-full aspect-[63/88] rounded-2xl overflow-hidden bg-[#111] mb-3 relative shrink-0 shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/10 group-hover:border-[#d4af37]/50 transition-colors">
                  <img
                    src={getHighResImage(card.img_url || card.image_url, card.name_jp || card.name_zh, card.set_code + ' ' + card.card_number, 'snkrdunk_' + card.id)}
                    alt={card.display || card.name_jp}
                    className={getImageClass(card.img_url || card.image_url) + " group-hover:scale-105 transition-transform duration-500"}
                    loading="lazy"
                  />
                  {card.rank && (
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10">
                      <span className="text-[#d4af37] font-black text-xs">#{card.rank}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-300 text-center line-clamp-2 px-2 hover:text-white transition-colors">
                  {card.display || card.name_jp}
                </p>
                {card.price && (
                  <p className="text-[#d4af37] font-mono text-sm mt-1">
                    ¥{card.price.toLocaleString()}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
