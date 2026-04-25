import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp, Activity } from 'lucide-react';

interface PriceTrendProps {
  productId: string;
}

interface HistoryItem {
  date: string;
  psa10: number | null;
  raw: number | null;
  timestamp: any;
}

export const PriceTrend: React.FC<PriceTrendProps> = ({ productId }) => {
  const [data, setData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!productId) return;
      try {
        const historyRef = collection(db, 'products', productId, 'price_history');
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
        const uniqueData = historyData.filter(item => item.psa10 || item.raw);
        
        setData(uniqueData);
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

  return (
    <div className="bg-white/5 rounded-2xl border border-white/5 p-4 sm:p-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#d4af37]" /> 價格歷史走勢
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#d4af37]"></div>
            <span className="text-[9px] font-black text-gray-500 uppercase">PSA 10</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-[9px] font-black text-gray-500 uppercase">RAW</span>
          </div>
        </div>
      </div>

      <div className="h-48 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPsa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              hide
              domain={['auto', 'auto']}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#111', 
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800,
                color: '#fff'
              }}
              itemStyle={{ padding: '2px 0' }}
              labelStyle={{ marginBottom: '4px', color: '#888' }}
            />
            <Area 
              type="monotone" 
              dataKey="psa10" 
              stroke="#d4af37" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorPsa)" 
              name="PSA 10 (HK$)"
              activeDot={{ r: 4, stroke: '#d4af37', strokeWidth: 2, fill: '#111' }}
            />
            <Area 
              type="monotone" 
              dataKey="raw" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorRaw)" 
              name="RAW (HK$)"
              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#111' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
