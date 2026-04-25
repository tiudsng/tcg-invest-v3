import React from 'react';

export const ConditionBadge: React.FC<{ condition: string; cardType?: string; title: string; className?: string }> = ({ condition, cardType, className }) => {
  const displayValue = String(cardType || condition || '');
  const isPSA = displayValue.toUpperCase().startsWith('PSA');
  
  if (isPSA) {
    return (
      <div className={`shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded bg-[#e3000f] border border-white/20 text-white text-[9px] sm:text-[10px] font-black flex items-center justify-center shadow-sm leading-tight ${className || ''}`}>
        {displayValue}
      </div>
    );
  }

  return (
    <div className={`shrink-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-[#3b415a]/80 backdrop-blur-md border border-white/10 text-white shadow-sm flex items-center justify-center leading-tight ${className || ''}`}>
      {displayValue}
    </div>
  );
};
