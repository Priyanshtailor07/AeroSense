import React from 'react';
import { BookOpen, ShieldAlert, Cpu, Zap, Wind } from 'lucide-react';

export default function ScientificOverview() {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/80 dark:border-slate-800 shadow-sm mt-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200/60 dark:border-slate-800/80">
        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">
            AirTrack Mathematical Dynamics & ASHRAE 62.1 Scientific Standards
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Autonomous closed-loop AQI-to-HVAC multi-variable tradeoff differential equations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        {/* Formula 1: CO2 Mass Balance */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <Wind className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>1. Indoor CO₂ Mass Balance</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-slate-900 text-indigo-950 dark:text-emerald-400 border border-indigo-200/60 dark:border-slate-800 font-mono text-[11px] font-semibold mb-2 leading-relaxed overflow-x-auto shadow-2xs">
              d[CO₂]/dt = (N·V̇_co₂)/V - (Q_fresh/V)([CO₂] - [CO₂]_amb)
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Scaled dynamically to room volume V and occupant exhalation rate (0.0187 m³/h/person).
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-500 mt-2 block">
            Target: &lt; 900 ppm
          </span>
        </div>

        {/* Formula 2: PM2.5 Particulate Balance */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>2. PM2.5 Mass Balance</span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-slate-900 text-rose-950 dark:text-rose-300 border border-rose-200/60 dark:border-slate-800 font-mono text-[11px] font-semibold mb-2 leading-relaxed overflow-x-auto shadow-2xs">
              d[PM₂.₅]/dt = (Q_fresh·PM_out)/V - ((Q·η_hepa + Q_dep)/V)·PM_in + leak
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Modelled HEPA efficiency η = 99.97% at 0.3 µm MPPS (H13 reference spec), envelope infiltration, and surface deposition.
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-500 mt-2 block">
            WHO Safe: &lt; 15.0 µg/m³
          </span>
        </div>

        {/* Formula 3: Darcy-Forchheimer Filter DP */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <Cpu className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>3. Darcy-Forchheimer Dust Loading</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-slate-900 text-amber-950 dark:text-amber-300 border border-amber-200/60 dark:border-slate-800 font-mono text-[11px] font-semibold mb-2 leading-relaxed overflow-x-auto shadow-2xs">
              ΔP = ΔP_clean · (Q/Q_max) · (1 + 2.8·[M_dust/M_max]^1.8)
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Exponential pressure drop rise across the HEPA filter cake as particulate mass accumulates.
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-500 mt-2 block">
            Clean: 120 Pa | Clogged: 340 Pa
          </span>
        </div>

        {/* Formula 4: Fan Affinity Cubic Power Law */}
        <div className="bg-white/70 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>4. Fan Affinity Cubic Law</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50/80 dark:bg-slate-900 text-emerald-950 dark:text-cyan-300 border border-emerald-200/60 dark:border-slate-800 font-mono text-[11px] font-semibold mb-2 leading-relaxed overflow-x-auto shadow-2xs">
              P_fan = P_base · (RPM/RPM_max)³ · (ΔP/ΔP_clean)
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              Blower power grows with the cube of fan speed. Running 100% vs 50% consumes 800% more energy!
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-500 mt-2 block">
            P ∝ RPM³ (Cubic Law)
          </span>
        </div>
      </div>
    </div>
  );
}
