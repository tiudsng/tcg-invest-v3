import React, { useState } from 'react';
import { Heart } from 'lucide-react';

export const FavoriteButton: React.FC<{ listingId: string; className?: string }> = ({ className }) => {
  const [active, setActive] = useState(false);
  return (
    <button onClick={(e) => { e.preventDefault(); setActive(!active); }} className={`p-2 rounded-full bg-white/80 ${className || ''}`}>
      <Heart size={20} fill={active ? "red" : "none"} color={active ? "red" : "gray"} />
    </button>
  );
};
