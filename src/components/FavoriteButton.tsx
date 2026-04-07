import React, { useState } from 'react';
import { Heart } from 'lucide-react';

export const FavoriteButton: React.FC<{ listingId: string; className?: string }> = ({ className }) => {
  const [active, setActive] = useState(false);
  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActive(!active); }} className={`p-2 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-sm transition-colors ${className || ''}`}>
      <Heart size={20} fill={active ? "#ef4444" : "none"} className={active ? "text-red-500" : "text-gray-500 dark:text-gray-300"} />
    </button>
  );
};
