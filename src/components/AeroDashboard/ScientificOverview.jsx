import React from 'react';
import { BookOpen, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';

export default function ScientificOverview() {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/80 shadow-sm mt-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200/60">
        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Scientific Standards & Priority Architecture</h3>
          <p className="text-xs text-slate-500">Engineering guidelines conforming to EPA, ASHRAE 62.1 & HEPA H13 standards</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Metric Standards Card */}
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <span>Mathematical & Metric Formulations</span>
          </div>
          <ul className="text-xs space-y-2 text-slate-600">
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 font-mono">•</span>
              <span><strong>PM2.5 Density:</strong> Expressed in µg/m³ (micrograms per cubic meter, particles ≤ 2.5 µm).</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 font-mono">•</span>
              <span><strong>HEPA Efficiency:</strong> η = 99.97% at Most Penetrating Particle Size (0.3 µm MPPS).</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-slate-400 font-mono">•</span>
              <span><strong>Relative Humidity:</strong> Expressed in % RH at ambient reference temperature.</span>
            </li>
          </ul>
        </div>

        {/* Priority Evaluation Cascade */}
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Strict Ambient Priority Rules</span>
          </div>
          <ol className="text-xs space-y-2 text-slate-600 list-decimal list-inside">
            <li className="text-rose-700 font-medium">
              <strong>Priority 1:</strong> Critical Hazard (AQI &gt; 150 or PM2.5 &gt; 55 µg/m³) overrides all other modes.
            </li>
            <li className="text-sky-700 font-medium">
              <strong>Priority 2:</strong> High Humidity (Humidity &gt; 75%) triggers precipitation & moisture state.
            </li>
            <li className="text-emerald-700 font-medium">
              <strong>Priority 3:</strong> Clean Air (AQI ≤ 50) invokes tranquil Mint/Sage palette.
            </li>
          </ol>
        </div>

        {/* Filtration Mechanisms Summary */}
        <div className="bg-white/60 rounded-xl p-4 border border-slate-200/50">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>HEPA Filtration Mechanisms</span>
          </div>
          <div className="text-xs space-y-1.5 text-slate-600">
            <div><strong>1. Interception:</strong> Medium particles (0.1–1.0 µm) follow streamlines and adhere to fibers.</div>
            <div><strong>2. Inertial Impaction:</strong> Heavy particles (&gt; 1.0 µm) slam directly due to linear momentum.</div>
            <div><strong>3. Brownian Diffusion:</strong> Ultra-fine particles (&lt; 0.1 µm) collide with gas molecules in random walks.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
