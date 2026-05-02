const fs = require('fs');
const path = './src/ProductDetail.tsx';
let c = fs.readFileSync(path, 'utf-8');

// Find the start of the corrupted block:
const startIdx = c.indexOf('{/* Market Statistics Grid (HKD Corrected) */}');
if (startIdx === -1) {
  console.log("Could not find start index!");
} else {
  // Everything before the corrupted code:
  const header = c.slice(0, startIdx);

  const cleanFooter = `            {/* Market Statistics Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">平均成交價</span>
                <span className="text-sm sm:text-lg font-black text-white tracking-tighter">
                  HK\${Math.round((product.market_data?.avg_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-green-500/70 uppercase tracking-widest mb-1.5">歷史最高價</span>
                <span className="text-sm sm:text-lg font-black text-[#30d158] tracking-tighter">
                  HK\${Math.round((product.market_data?.max_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-white/5 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-red-500/70 uppercase tracking-widest mb-1.5">市場最低價</span>
                <span className="text-sm sm:text-lg font-black text-[#ff453a] tracking-tighter">
                  HK\${Math.round((product.market_data?.min_price || 0) * 0.052).toLocaleString()}
                </span>
              </div>
            </div>

            {/* PSA Population Data Report */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-white/20 transition-all overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 whitespace-nowrap">鑑定總數</span>
                <span className="text-base sm:text-xl font-black text-white tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_total || (product as any).psa_pop_total;
                    return (val !== undefined && val !== null && Number(val) > 0) ? Number(val).toLocaleString() : '-';
                  })()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-[#d4af37]/30 transition-all border-l border-r border-white/10 overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 font-sans whitespace-nowrap">PSA 10 數量</span>
                <span className="text-base sm:text-xl font-black text-[#d4af37] tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_10 || (product as any).psa_pop_10 || product.market_data?.psa10_population || (product as any).psa10_population;
                    return (val !== undefined && val !== null && Number(val) > 0) ? Number(val).toLocaleString() : '-';
                  })()}
                </span>
              </div>
              <div className="p-3 sm:p-4 bg-[#1c1c1e]/50 backdrop-blur-xl rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center group hover:border-purple-500/30 transition-all overflow-hidden text-center">
                <span className="text-[8px] sm:text-[10px] font-black text-gray-500 uppercase tracking-tight sm:tracking-widest mb-1.5 whitespace-nowrap">PSA 10 比例</span>
                <span className="text-base sm:text-xl font-black text-purple-400 tracking-tighter">
                  {(() => {
                    const val = product.market_data?.psa_pop_10_percent || (product as any).psa_pop_10_percent;
                    return (val && val !== '0%') ? val : '-';
                  })()}
                </span>
              </div>
            </div>

            {/* Price Trend Chart */}
            <div className="mb-8">
              <PriceTrend productId={product.card_id || product.id || id || ''} />
            </div>

            {/* Investment Potential Summary */}
            <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> 投資潛力分析
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>增值潛力</span>
                    <span className="text-white">{product.investment_metrics?.growth_potential ? (product.investment_metrics.growth_potential >= 80 ? '極強' : '穩健') : (product.rank <= 5 ? '極強' : '穩健')}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: \`\${product.investment_metrics?.growth_potential || (100 - (product.rank || 0) * 5)}%\` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>持有建議</span>
                    <span className="text-white">{product.investment_metrics?.holding_advice || '長期 (2-3年)'}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#d4af37] rounded-full" style={{ width: \`\${product.investment_metrics?.holding_score || 85}%\` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1.5 uppercase">
                    <span>市場流通性</span>
                    <span className="text-white">{liquidity}</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: liquidity === '極高' ? '95%' : '80%' }} />
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed font-bold italic mt-4 border-l-2 border-[#d4af37]/30 pl-3">
                  {product.analysis_quote ? (
                    \`「\${product.analysis_quote}」\`
                  ) : (
                    \`「\${product.name_zh} 作為 \${product.set_name} 的明星卡牌，其藝術價值與稀有度確保了強大的市場深度與長期升值空間。」\`
                  )}
                </p>
              </div>
            </div>

            {/* Extended Details */}
            {(product as any).description && (
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 mb-6">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">卡片描述</h4>
                <p className="text-sm text-gray-300 leading-relaxed font-medium">{(product as any).description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              {(['rarity_zh', 'type', 'illustrator', 'weakness'] as const).map((key) => {
                const val = (product as any)[key];
                if (!val) return null;
                const labels: Record<string, string> = { rarity_zh: '稀有度', type: '類型', illustrator: '繪師', weakness: '弱點' };
                return (
                  <div key={key} className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="block text-[10px] font-black text-gray-500 uppercase mb-1">{labels[key]}</span>
                    <span className="text-sm font-bold text-gray-200">{val}</span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto pt-8 border-t border-white/10">
              <button 
                onClick={() => navigate(\`/?search=\${encodeURIComponent(product.name_zh)}\`)}
                className="w-full bg-white hover:bg-gray-200 text-black py-4 sm:py-5 rounded-[1.25rem] sm:rounded-[1.5rem] font-black text-lg sm:text-xl flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 shadow-lg shadow-white/5">
                <ShoppingBag className="w-6 h-6" />
                在市集尋找此卡
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsZoomed(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out">
            <button 
              className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-[110]"
              onClick={() => setIsZoomed(false)}
            >
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={getProductImage()}
              alt={product.name_zh}
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
`;

  fs.writeFileSync(path, header + cleanFooter);
}
