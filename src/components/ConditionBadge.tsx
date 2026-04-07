import React from 'react';

export const ConditionBadge: React.FC<{ condition: string; cardType?: string; title: string; className?: string }> = ({ condition, cardType, className }) => {
  const isPSA = cardType?.startsWith('PSA');
  return (
    <div className={`px-2 py-1 rounded text-xs font-bold ${isPSA ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-800'} ${className || ''}`}>
      {cardType || condition}
    </div>
  );
};
