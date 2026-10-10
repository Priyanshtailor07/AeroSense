import React from 'react';
import { ArrowUpRight, ArrowDownRight, Server } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  unit,
  latexUnit,
  icon: Icon,
  badge,
  badgeColor,
  min = 0,
  max = 100,
  history = [20, 24, 22, 28, 30, 26, 29],
  description,
  accentColor = '#10b981',
  isLive = false,
  isEstimated = false,
}) {
  // A null value means the API did not publish this metric. Render it as "n/a"
  // rather than coercing it into a number that would read as a real measurement.
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const displayValue = hasValue ? value.toLocaleString() : value == null ? 'n/a' : value;
  const percentage = hasValue
    ? Math.min(100, Math.max(0, ((value - min) / (max - min || 1)) * 100))
    : 0;

  // Calculate mini sparkline SVG path
  const width = 110;
  const height = 28;
  const safeHistory =
    Array.isArray(history) && history.length > 0 ? history : hasValue ? [value] : [];

  const points = (safeHistory.length > 0 ? safeHistory : [])
    .map((val, idx) => {
      const x = (idx / (safeHistory.length - 1 || 1)) * width;
      const norm = (val - min) / (max - min || 1);
      const y = height - Math.max(4, Math.min(height - 4, norm * height));
      return `${x},${y}`;
    })
    .join(' ');

  const isTrendingUp = safeHistory.length > 1 ? safeHistory[safeHistory.length - 1] >= safeHistory[0] : true;
  const showTrend = safeHistory.length > 0;

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/70 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 relative group flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {title}
              </h3>
              {isEstimated && (
                <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-800">
                  Estimated
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
                {displayValue}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-sans">
                {unit}
              </span>
            </div>
          </div>
        </div>

        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${badgeColor}`}>
          {badge}
        </span>
      </div>

      {/* Progress Bar & Visual Gauge */}
      <div className="my-3.5">
        <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 mb-1 font-mono">
          <span>{min}</span>
          <span className="text-slate-500 dark:text-slate-400 font-sans italic">{latexUnit || unit}</span>
          <span>{max}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-200/60 dark:bg-slate-700/60 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}80`,
            }}
          />
        </div>
      </div>

      {/* Sparkline & Context Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
          {isTrendingUp ? (
            <span className="flex items-center text-rose-500 font-medium">
              <ArrowUpRight className="w-3 h-3" /> {isLive ? 'AWS' : '+Live'}
            </span>
          ) : (
            <span className="flex items-center text-emerald-500 font-medium">
              <ArrowDownRight className="w-3 h-3" /> {isLive ? 'AWS' : '-Live'}
            </span>
          )}
          <span className="truncate max-w-[120px]">{description}</span>
        </div>

        {/* Mini SVG Sparkline */}
        <div className="w-24 h-6 opacity-75">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <polyline
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
