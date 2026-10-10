import React from 'react';
import { Terminal, DollarSign, Server, Sparkles, Sliders, AlertCircle } from 'lucide-react';

export default function TelemetryAuditCard({
  damperPct = 20,
  recommendedDamperPct = 20,
  fanSpeedPct = 28,
  cumulativeCostUsd = 0.34,
  cumulativeEnergyKwh = 0.85,
  rationale = '',
  controlMode = 'ai',
  mode = 'simulation',
  recommendationOnly = true,
  selectedZone = 'Zone-1',
}) {
  const getFanBadge = () => {
    if (fanSpeedPct >= 70.0) {
      return {
        label: '[POWER MODE // MAX SCRUBBING]',
        color: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900',
      };
    }
    if (fanSpeedPct >= 45.0) {
      return {
        label: '[BALANCED PURIFICATION]',
        color: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-900',
      };
    }
    return {
      label: '[LOW USAGE // ECO MODE]',
      color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900',
    };
  };

  const fanBadge = getFanBadge();

  const getReasoningBadge = () => {
    if (mode === 'aws_live') {
      return {
        label: `AWS LIVE DYNAMODB OPTIMIZER (${selectedZone})`,
        color: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
      };
    }
    if (controlMode === 'manual') {
      return {
        label: 'MANUAL RADIO OVERRIDE ACTIVE',
        color: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
      };
    }
    if (controlMode === 'bms') {
      return {
        label: 'STATIC BMS THRESHOLD ENGINE',
        color: 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
      };
    }
    return {
      label: 'AUTONOMOUS MULTI-OBJECTIVE AI REASONING ENGINE',
      color: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
    };
  };

  const engineBadge = getReasoningBadge();

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700">
            <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Machine Telemetry & Optimization Audit
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'aws_live'
                ? 'Live DynamoDB BuildingTelemetry feed & advisory optimizer recommendations'
                : 'Real-time closed-loop actuation feed, variable frequency drive & machine rationale'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
          {mode === 'aws_live' ? <Server className="w-3 h-3 text-emerald-400" /> : null}
          {mode === 'aws_live' ? 'AWS TELEMETRY STREAM' : 'CLOSED-LOOP ACTUATION'}
        </span>
      </div>

      {/* 3 Telemetry Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
        {/* Damper Opening: Current vs Recommended */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono uppercase text-slate-500 dark:text-slate-400 text-[11px]">Current Damper</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{damperPct.toFixed(1)}%</span>
            </div>
            {mode === 'aws_live' && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800">
                <span className="font-mono uppercase text-indigo-600 dark:text-indigo-400 text-[10px]">Recommended</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{recommendedDamperPct.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden mt-1">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, damperPct))}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">Fresh air intake angle regulation</p>
        </div>

        {/* Purifier Fan Speed */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono uppercase text-slate-500 dark:text-slate-400 text-[11px]">Purifier VFD Fan Speed</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{fanSpeedPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden mt-1 mb-1.5">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, fanSpeedPct))}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border inline-block ${fanBadge.color}`}>
            {fanBadge.label}
          </span>
        </div>

        {/* Cumulative Cost */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-3.5 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-mono uppercase text-slate-500 dark:text-slate-400 text-[11px]">Cumulative Cost</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              ${cumulativeCostUsd.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 mt-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-mono text-[11px]">Energy: {cumulativeEnergyKwh.toFixed(2)} kWh</span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'aws_live' ? 'Energy consumption & filter wear (Estimated)' : 'Fan power kWh tariff + HEPA filter cake wear'}
          </p>
        </div>
      </div>

      {/* Live AI Reasoning Box */}
      <div className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 relative shadow-inner">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${engineBadge.color}`}>
            {engineBadge.label}
          </span>
          <div className="flex items-center gap-2">
            {mode === 'aws_live' && recommendationOnly && (
              <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                RECOMMENDATION ONLY
              </span>
            )}
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping"></span>
              {mode === 'aws_live' ? 'AWS LIVE FEED' : 'LIVE AUDIT STREAM'}
            </span>
          </div>
        </div>
        <p className="font-mono text-xs text-slate-700 dark:text-slate-300 leading-relaxed min-h-[2.5rem]">
          {rationale || 'Telemetry initialized: Analyzing indoor CO₂ and outdoor particulate levels.'}
        </p>
      </div>
    </div>
  );
}
