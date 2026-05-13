/**
 * PriceTrend.tsx — Apple Style Sparkline + Stats
 * 
 * Apple Style Design:
 * - No axes, no gridlines — just a smooth monotone curve
 * - Dynamic color: green (#30D158) if positive, red (#FF453A) if negative
 * - Area fill with linear gradient (30% → 0% opacity)
 * - Glassmorphism container (backdrop-blur + semi-transparent bg)
 * - Hover tooltip showing date + price (Apple-style minimal)
 * - Stats table below the chart
 * 
 * Data source: GET /api/price-history/:snkrdunkId?days=30&currency=HKD
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint {
  date: string;
  price: number | null;
  rawPrice: number | null;
  timestamp: string;
  source: string | null;
}

interface ApiStats {
  current: number;
  min: number;
  max: number;
  change: number;
  changePct: number;
  currency: string;
}

interface ApiResponse {
  success: boolean;
  cardId: string;
  docPath: string;
  data: PricePoint[];
  stats: ApiStats | null;
  count: number;
  filledCount: number;
}

// ─── Custom Tooltip (Apple Style) ───────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const price = payload[0]?.value;
  if (price === null || price === undefined) return null;

  const change = payload[1]?.value as number | undefined;
  const changePct = payload[2]?.value as number | undefined;

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-lg font-black text-white tracking-tight">HK$ {price.toLocaleString()}</p>
      {change !== undefined && changePct !== undefined && (
        <p className={`text-[10px] font-bold mt-0.5 ${change >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
          {change >= 0 ? '+' : ''}{change.toLocaleString()} ({change >= 0 ? '+' : ''}{changePct}%)
        </p>
      )}
    </div>
  );
};

// ─── Sparkline (No Axes) ────────────────────────────────────────────────────────

interface SparklineProps {
  data: PricePoint[];
  isPositive: boolean;
}

const Sparkline = ({ data, isPositive }: SparklineProps) => {
  const COLOR = isPositive ? '#30D158' : '#FF453A';
  const COLOR_DIM = isPositive ? '#30D158' : '#FF453A';

  // Build chart data — null prices are filtered upstream by forward-fill
  const chartData = data.map(d => ({
    date: d.date,
    price: d.price,
    change: d.price !== null && data[0]?.price !== null ? d.price - data[0].price : 0,
    changePct: d.price !== null && data[0]?.price !== null
      ? Math.round(((d.price - data[0].price) / data[0].price) * 10000) / 100
      : 0,
  }));

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <XAxis dataKey="date" hide />
          <YAxis domain={['auto', 'auto']} hide />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: 'rgba(255,255,255,0.15)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
            }}
            wrapperStyle={{ outline: 'none' }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={COLOR}
            strokeWidth={2}
            fill="url(#sparkFill)"
            fillOpacity={1}
            dot={false}
            activeDot={{
              r: 5,
              fill: COLOR,
              stroke: 'rgba(0,0,0,0.5)',
              strokeWidth: 2,
            }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Stats Table ───────────────────────────────────────────────────────────────

interface StatsTableProps {
  stats: ApiStats | null;
  data: PricePoint[];
  filledCount: number;
}

const StatsTable = ({ stats, data, filledCount }: StatsTableProps) => {
  if (!stats) return null;

  const isPositive = stats.change >= 0;
  const TrendIcon = isPositive ? TrendingUp : stats.change === 0 ? Minus : TrendingDown;
  const trendColor = isPositive ? 'text-[#30D158]' : stats.change === 0 ? 'text-gray-400' : 'text-[#FF453A]';
  const changeStr = `${stats.change >= 0 ? '+' : ''}${stats.change.toLocaleString()}`;
  const pctStr = `${stats.change >= 0 ? '+' : ''}${stats.changePct}%`;

  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-[#d4af37]" />
          市場統計
        </h3>
        {filledCount > 0 && (
          <span className="text-[9px] font-bold text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded-full">
            +{filledCount} filled
          </span>
        )}
      </div>

      {/* Price + Change */}
      <div className="px-5 py-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">當前價格</p>
          <p className="text-2xl font-black text-white tracking-tight">HK$ {stats.current.toLocaleString()}</p>
        </div>
        <div className={`flex items-center gap-1.5 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <div className="text-right">
            <p className="text-sm font-black">{changeStr}</p>
            <p className="text-[10px] font-bold opacity-80">{pctStr}</p>
          </div>
        </div>
      </div>

      {/* Min / Max / Range */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-2">
        {[
          { label: '最低', value: stats.min, color: 'text-[#FF453A]' },
          { label: '平均', value: Math.round((stats.min + stats.max) / 2), color: 'text-gray-300' },
          { label: '最高', value: stats.max, color: 'text-[#30D158]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/[0.03] rounded-xl p-3 text-center">
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-sm font-black ${color}`}>HK$ {value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Period selector — future enhancement slot */}
      <div className="px-5 pb-4 flex gap-2">
        {['7D', '30D', '90D'].map(period => (
          <button
            key={period}
            className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
              period === '30D'
                ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30'
                : 'bg-white/[0.03] text-gray-500 border border-transparent hover:bg-white/[0.06]'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface PriceTrendProps {
  productId: string;
  collectionName?: string;
  apiBaseUrl?: string;
  days?: number;
  currency?: 'SGD' | 'HKD';
}

export const PriceTrend: React.FC<PriceTrendProps> = ({
  productId,
  collectionName = 'products',
  apiBaseUrl = '',
  days = 30,
  currency = 'HKD',
}) => {
  const [data, setData] = useState<PricePoint[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [filledCount, setFilledCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive snkrdunkId from productId
  // productId may be: "snkrdunk_104593" or just "104593"
  const snkrdunkId = productId.replace(/^snkrdunk_/, '');

  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!snkrdunkId) {
        setLoading(false);
        return;
      }

      try {
        // Try the API endpoint first (server-side with forward-fill + currency conversion)
        const apiUrl = apiBaseUrl
          ? `${apiBaseUrl}/api/price-history/${snkrdunkId}?days=${days}&currency=${currency}`
          : `/api/price-history/${snkrdunkId}?days=${days}&currency=${currency}`;

        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: ApiResponse = await res.json();

        if (json.success && json.data.length > 0) {
          setData(json.data);
          setStats(json.stats);
          setFilledCount(json.filledCount ?? 0);
        } else {
          // No data — gracefully show empty state
          setData([]);
          setStats(null);
        }
      } catch (err) {
        console.warn('[PriceTrend] API failed, setting empty state:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
        setData([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPriceHistory();
  }, [snkrdunkId, days, currency, apiBaseUrl]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-[160px] bg-white/[0.03] rounded-2xl border border-white/[0.05] animate-pulse" />
        <div className="h-[180px] bg-white/[0.03] rounded-2xl border border-white/[0.05] animate-pulse" />
      </div>
    );
  }

  // ── Empty / Error ─────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {/* Placeholder sparkline */}
        <div className="h-[160px] bg-white/[0.03] rounded-2xl border border-white/[0.05] flex items-center justify-center">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            等待數據沉積...
          </p>
        </div>
        <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/[0.06] px-5 py-4">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-[#d4af37]" />
            市場統計
          </p>
          <p className="text-xs text-gray-600 font-bold">
            每日 04:00 自動同步，定時記錄價格歷史
          </p>
          {error && (
            <p className="text-[9px] text-red-500/60 mt-1 font-mono">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Positive / Negative coloring ─────────────────────────────────────────────
  const isPositive = !stats || stats.change >= 0;
  const COLOR = isPositive ? '#30D158' : '#FF453A';

  return (
    <div className="flex flex-col gap-4">
      {/* Apple Style Sparkline Card */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden px-1 pt-1">
        {/* Inline stats overlay */}
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">PSA10 趨勢</p>
            {stats && (
              <p className="text-xl font-black text-white tracking-tight">
                HK$ {stats.current.toLocaleString()}
              </p>
            )}
          </div>
          {stats && (
            <div className="flex items-center gap-1">
              <span className={`text-sm font-black ${isPositive ? 'text-[#30D158]' : 'text-[#FF453A]'}`}>
                {stats.change >= 0 ? '+' : ''}{stats.changePct}%
              </span>
              {isPositive
                ? <TrendingUp className="w-4 h-4 text-[#30D158]" />
                : <TrendingDown className="w-4 h-4 text-[#FF453A]" />}
            </div>
          )}
        </div>

        {/* Sparkline */}
        <Sparkline data={data} isPositive={isPositive} />
      </div>

      {/* Stats Table */}
      <StatsTable stats={stats} data={data} filledCount={filledCount} />
    </div>
  );
};
