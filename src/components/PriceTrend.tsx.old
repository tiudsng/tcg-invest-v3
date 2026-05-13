import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { TrendingUp, Activity } from 'lucide-react';

interface PriceTrendProps {
  productId: string;
  collectionName?: string;
}

interface HistoryItem {
  date: string;
  psa10: number | null;
  raw: number | null;
  timestamp: any;
}

export const PriceTrend: React.FC<PriceTrendProps> = ({ productId, collectionName = 'products' }) => {
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!productId) return;
      try {
        const historyRef = collection(db, collectionName, productId, 'price_history');
        const q = query(historyRef, orderBy('createdAt', 'asc'), limit(50));
        const snapshot = await getDocs(q);
        
        const historyData = snapshot.docs.map(doc => {
          const d = doc.data();
          const timestamp = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
          return {
            date: format(timestamp, 'MM/dd'),
            psa10: d.psa10_price || null,
            raw: d.raw_price || null,
            timestamp: timestamp
          };
        });

        // Filter out records without prices and deduplicate by day for cleaner chart
        setData(historyData.filter(item => item.psa10 || item.raw));
      } catch (err) {
        console.error("Error fetching price history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [productId]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center bg-white/5 rounded-2xl border border-white/5">
        <div className="animate-pulse text-gray-500 text-xs font-bold uppercase tracking-widest">載入走勢圖...</div>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/5 text-center px-6">
        <Activity className="w-8 h-8 text-gray-700 mb-2" />
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">尚無足夠歷史數據生成走勢</p>
        <p className="text-[9px] text-gray-600 mt-1 uppercase">Hermès Agent 將定期更新並記錄數據</p>
      </div>
    );
  }

  // Calculate statistics for the table
  const calculateStats = (key: 'psa10' | 'raw') => {
    const values = data.map(item => item[key]).filter((v): v is number => v !== null);
    if (values.length === 0) return null;

    const count = values.length;
    const recent = values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((span, v) => span + v, 0) / count;
    
    // 7-day change (using the oldest value in the range if less than 7 points)
    const start7 = values[Math.max(0, values.length - 7)];
    const change7 = recent - start7;
    const pct7 = (change7 / start7) * 100;

    // 30-day change
    const start30 = values[Math.max(0, values.length - 30)];
    const change30 = recent - start30;
    const pct30 = (change30 / start30) * 100;

    return { count, recent, max, min, avg, change7, pct7, change30, pct30 };
  };

  const psaStats = calculateStats('psa10');
  const rawStats = calculateStats('raw');

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    return `HK$ ${Math.round(val).toLocaleString()}`;
  };

  const formatChange = (diff: number, pct: number) => {
    const sign = diff >= 0 ? '+' : '';
    const color = diff >= 0 ? 'text-green-400' : 'text-red-400';
    return (
      <div className={`flex flex-col items-end ${color}`}>
        <span>{sign}{Math.round(diff).toLocaleString()}円</span>
        <span className="text-[10px] font-medium">({sign}{pct.toFixed(2)}%)</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Table */}
      <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-md">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#d4af37]" /> 價格統計數據
          </h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="p-3 border-b border-white/5"></th>
              <th className="p-3 border-b border-white/5 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">美品 (RAW)</th>
              <th className="p-3 border-b border-white/5 text-right text-[10px] font-black text-[#d4af37] uppercase tracking-wider">PSA10</th>
            </tr>
          </thead>
          <tbody className="text-[11px] font-bold">
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">數據數 (筆)</td>
              <td className="p-3 text-right text-gray-300">{rawStats?.count || "-"}</td>
              <td className="p-3 text-right text-gray-300">{psaStats?.count || "-"}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">直近價格</td>
              <td className="p-3 text-right text-white">{formatCurrency(rawStats?.recent)}</td>
              <td className="p-3 text-right text-[#d4af37]">{formatCurrency(psaStats?.recent)}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">最高價格</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(rawStats?.max)}</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(psaStats?.max)}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">平均價格</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(rawStats?.avg)}</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(psaStats?.avg)}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">最低價格</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(rawStats?.min)}</td>
              <td className="p-3 text-right text-gray-300">{formatCurrency(psaStats?.min)}</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="p-3 text-gray-500">騰落率(7日)</td>
              <td className="p-3 text-right">{rawStats ? formatChange(rawStats.change7, rawStats.pct7) : "-"}</td>
              <td className="p-3 text-right">{psaStats ? formatChange(psaStats.change7, psaStats.pct7) : "-"}</td>
            </tr>
            <tr>
              <td className="p-3 text-gray-500">騰落率(30日)</td>
              <td className="p-3 text-right">{rawStats ? formatChange(rawStats.change30, rawStats.pct30) : "-"}</td>
              <td className="p-3 text-right">{psaStats ? formatChange(psaStats.change30, psaStats.pct30) : "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
