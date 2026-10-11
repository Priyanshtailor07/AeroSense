import React, { useState } from 'react';
import { Sparkles, Shield, Cpu, Wind, Info, CheckCircle, ArrowRight, Gauge, Layers } from 'lucide-react';
import HepaCanvas3D from './HepaCanvas3D';

export default function HepaChamber() {
  const [activeMechanism, setActiveMechanism] = useState('all');
  const [filterSpeed, setFilterSpeed] = useState(1.0);

  const mechanisms = [
    {
      id: 'interception',
      name: '1. Interception',
      range: '0.1 – 1.0 µm',
      formula: 'r_p \\ge d_{stream}',
      summary: 'Particles follow streamline curves but graze within one particle radius of a micro-fiber and adhere via van der Waals forces.',
      color: 'border-sky-500/60 bg-sky-950/20 text-sky-400',
      activeColor: 'ring-2 ring-sky-400 bg-sky-950/50',
      detail: 'Crucial for pollen, large bacteria, and fine dust. The streamline curves around the fiber, but because the particle has non-zero radius, its surface touches the fiber and sticks.',
    },
    {
      id: 'impaction',
      name: '2. Inertial Impaction',
      range: '> 1.0 µm',
      formula: 'Stk = \\frac{\\rho_p d_p^2 u}{18 \\mu d_f} > 1',
      summary: 'Heavy particles possess high kinetic momentum and cannot navigate sudden airflow bends, slamming straight into fibers.',
      color: 'border-rose-500/60 bg-rose-950/20 text-rose-400',
      activeColor: 'ring-2 ring-rose-400 bg-rose-950/50',
      detail: 'Governed by the Stokes Number (Stk). Large particles cannot make the sharp turn in the air streamline around the cylindrical fiber and impact the front face.',
    },
    {
      id: 'diffusion',
      name: '3. Brownian Diffusion',
      range: '< 0.1 µm',
      formula: 'D = \\frac{k_B T C_c}{3 \\pi \\mu d_p}',
      summary: 'Sub-micron viruses & ultra-fines are buffeted by gas molecules in erratic zig-zag paths until they contact a fiber.',
      color: 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400',
      activeColor: 'ring-2 ring-emerald-400 bg-emerald-950/50',
      detail: 'Ultra-fine particles undergo continuous Brownian motion caused by collisions with atmospheric nitrogen and oxygen molecules, dramatically increasing the capture likelihood.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Technical Specs */}
      <div className="glass-panel-dark rounded-2xl p-6 text-white border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-700/60 text-slate-300 border border-slate-600 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                Illustrative model
              </span>
              <span className="text-xs text-slate-400 font-mono">H13 reference parameters (EN 1822)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Inside the 3D Mechanical Chamber
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              A visualisation of how sub-micron particulates are captured across a pleated filter element.
              The geometry and the figures below are <strong>model parameters</strong> taken from published
              H13 reference specifications — they describe this simulation, not a measurement of installed
              equipment, and bypass leakage is not modelled.
            </p>
          </div>

          {/* Quick Efficiency Stats Pill */}
          <div className="flex items-center gap-4 bg-slate-900/90 p-4 rounded-xl border border-slate-800 shrink-0">
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Modelled rate</div>
              <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">99.97%</div>
              <div className="text-[10px] text-slate-400 font-mono">at 0.3 µm MPPS (H13 spec)</div>
            </div>
            <div className="h-10 w-px bg-slate-800"></div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Pleats rendered</div>
              <div className="text-2xl font-black text-cyan-400 font-mono tracking-tight">32</div>
              <div className="text-[10px] text-slate-400 font-mono">Geometry parameter</div>
            </div>
          </div>
        </div>

        {/* Speed Adjustment Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-cyan-400" />
              Airflow Velocity (CFM):
            </span>
            <div className="flex items-center gap-2">
              {[0.5, 1.0, 1.8].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setFilterSpeed(spd)}
                  className={`px-3 py-1 rounded-lg font-mono font-semibold transition ${
                    filterSpeed === spd
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {spd === 0.5 ? 'Low (120 CFM)' : spd === 1.0 ? 'Normal (280 CFM)' : 'Turbo (500 CFM)'}
                </button>
              ))}
            </div>
          </div>

          <div className="text-slate-400 text-xs">
            Tip: Rotate the filter edge-on to inspect the continuous V-shape pleat profiles.
          </div>
        </div>
      </div>

      {/* 3D WebGL Mechanical Chamber */}
      <HepaCanvas3D
        activeMechanism={activeMechanism}
        filterSpeed={filterSpeed}
      />

      {/* Educational Filtration Mechanisms Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-900 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                Tri-Physics Aerodynamic Capture Mechanisms
              </h2>
              <p className="text-xs text-slate-500">
                Why HEPA filters are not simple sieves: how 3 independent physical phenomena operate simultaneously
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveMechanism('all')}
            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition ${
              activeMechanism === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Show All Mechanisms
          </button>
        </div>

        {/* Mechanism Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {mechanisms.map((mech) => {
            const isActive = activeMechanism === mech.id;
            return (
              <div
                key={mech.id}
                onClick={() => setActiveMechanism(mech.id)}
                className={`glass-panel rounded-2xl p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-lg ${
                  isActive ? `${mech.activeColor} shadow-md` : 'hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900 text-sm tracking-tight">{mech.name}</h3>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {mech.range}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    {mech.summary}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-900/5 font-mono text-[11px] text-slate-700 border border-slate-200/50 mb-3">
                    Formula: <span className="font-semibold text-slate-900">{mech.formula}</span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-normal">
                    {mech.detail}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className={isActive ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                    {isActive ? 'Active Highlight' : 'Click to Inspect'}
                  </span>
                  <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'translate-x-1' : ''}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
