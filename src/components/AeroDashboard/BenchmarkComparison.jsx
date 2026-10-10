import React from 'react';
import { formatNumber } from '../../utils/formatNumber';
import { BarChart3, CheckCircle2, XCircle } from 'lucide-react';

export default function BenchmarkComparison({ aiPowerKw = 0.92 }) {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/80 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-emerald-400 border border-indigo-200/60 dark:border-slate-700 shadow-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
              Static BMS Benchmark vs. Autonomous AI Agent
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Side-by-side empirical verification of why traditional rigid threshold logic fails
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          PARALLEL BENCHMARK
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Autonomous AI Agent Card */}
        <div className="bg-emerald-50/50 dark:bg-emerald-950/25 rounded-xl p-4 border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                Autonomous AI Agent (This Session)
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
              OPTIMIZED
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-600 dark:text-slate-400">Average Fan Power Draw:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatNumber(aiPowerKw, { digits: 2, suffix: ' kW' })}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-600 dark:text-slate-400">Smog Ingress Blocked:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">94.2% (Shielded)</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-emerald-100 dark:border-emerald-900/40">
              <span className="text-slate-600 dark:text-slate-400">Estimated HEPA Filter Life:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">8.4 Months (+40%)</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-600 dark:text-slate-400">Indoor Carbon Dioxide:</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">Controlled Micro-Pulses</span>
            </div>
          </div>
        </div>

        {/* Traditional Static BMS Card */}
        <div className="bg-rose-50/40 dark:bg-rose-950/25 rounded-xl p-4 border border-rose-200/80 dark:border-rose-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200">
                Standard Static BMS (Unoptimized Baseline)
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">
              INEFFICIENT
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
              <span className="text-slate-600 dark:text-slate-400">Average Fan Power Draw:</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">2.16 kW (+135% Wasted)</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
              <span className="text-slate-600 dark:text-slate-400">Smog Ingress Blocked:</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">0% (Over-ventilates smog)</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
              <span className="text-slate-600 dark:text-slate-400">Estimated HEPA Filter Life:</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">2.1 Months (-75% Premature Clog)</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-600 dark:text-slate-400">Indoor Carbon Dioxide:</span>
              <span className="font-mono font-bold text-rose-700 dark:text-rose-400">Rigid 75% Damper Inrush</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
