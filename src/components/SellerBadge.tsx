import React from 'react';
import { Award, Star, ShieldCheck } from 'lucide-react';

export const SellerBadge: React.FC<{ transactions: number; rating: number; isProfessional: boolean }> = ({ transactions, rating, isProfessional }) => {
  if (isProfessional) return <div className="flex items-center gap-1 text-amber-600 font-bold text-xs"><Award size={14}/>專業賣家</div>;
  if (transactions > 50) return <div className="flex items-center gap-1 text-yellow-600 font-bold text-xs"><Star size={14}/>金牌賣家</div>;
  return null;
};
