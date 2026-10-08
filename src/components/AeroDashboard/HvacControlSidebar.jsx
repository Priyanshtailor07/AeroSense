import React from 'react';
import {
  Building2,
  Wind,
  Cpu,
  Users,
  DollarSign,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';

export default function HvacControlSidebar({
  // Room specs
  roomPreset,
  setRoomPreset,
  roomVolM3,
  setRoomVolM3,
  ceilingHeightM,
  setCeilingHeightM,
  targetCO2Max,
  setTargetCO2Max,
  infiltrationAch,
  setInfiltrationAch,

  // Scenario
  airScenario,
  setAirScenario,

  // Mode
  controlMode,
  setControlMode,
  manualDamper,
  setManualDamper,
  manualFan,
  setManualFan,

  // Occupants
  occupancy,
  setOccupancy,

  // Tariff
  isPeakTariff,
  setIsPeakTariff,

  // Filter
  filterState,
  setFilterState,
}) {
  const roomPresets = [
    {
      id: 'icu',
      title: 'Hospital ICU / Surgical',
      subtitle: '320 m³ · 12 People · Ultra-tight (<10 µg/m³)',
      badge: 'ICU (320m³)',
      vol: 320,
      height: 3.2,
      targetCO2: 800,
      ach: 0.05,
      occ: 12,
    },
    {
      id: 'classroom',
      title: 'School Classroom',
      subtitle: '240 m³ · 35 Students · CO₂ Sensitive',
      badge: 'CLASSROOM (240m³)',
      vol: 240,
      height: 3.0,
      targetCO2: 850,
      ach: 0.15,
      occ: 35,
    },
    {
      id: 'office',
      title: 'Commercial Office / Hall',
      subtitle: '500 m³ · 28 People · Standard Balanced',
      badge: 'COMMERCIAL (500m³)',
      vol: 500,
      height: 3.5,
      targetCO2: 850,
      ach: 0.12,
      occ: 28,
    },
    {
      id: 'auditorium',
      title: 'Large Auditorium / Cleanroom',
      subtitle: '1,100 m³ · 65 People · High-volume Space',
      badge: 'AUDITORIUM (1100m³)',
      vol: 1100,
      height: 5.5,
      targetCO2: 900,
      ach: 0.18,
      occ: 65,
    },
  ];

  const airScenarios = [
    {
      id: 'clean',
      title: 'Clean Air Day (AQI 45)',
      subtitle: 'Ambient PM₂.₅: 25 µg/m³ · Whisper Eco Mode',
      color: 'hover:border-emerald-400',
      activeColor: 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200',
      dotColor: 'bg-emerald-600 dark:bg-emerald-400',
      pmVal: 25,
      aqiVal: 45,
    },
    {
      id: 'slight',
      title: 'Slightly Disturbed (AQI 190)',
      subtitle: 'Ambient PM₂.₅: 140 µg/m³ · Balanced Mode',
      color: 'hover:border-amber-400',
      activeColor: 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200',
      dotColor: 'bg-amber-600 dark:bg-amber-400',
      pmVal: 140,
      aqiVal: 190,
    },
    {
      id: 'disturbed',
      title: 'Fully Disturbed / Hazardous (AQI 420+)',
      subtitle: 'Ambient PM₂.₅: 390 µg/m³ · Power Scrubbing',
      color: 'hover:border-rose-400',
      activeColor: 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-200',
      dotColor: 'bg-rose-600 dark:bg-rose-400',
      pmVal: 390,
      aqiVal: 420,
    },
    {
      id: 'extreme',
      title: 'Catastrophic Spike (AQI 500)',
      subtitle: 'Ambient PM₂.₅: 495 µg/m³ · Max Scrubbing Shield',
      color: 'hover:border-red-600',
      activeColor: 'bg-red-50/90 dark:bg-red-950/50 border-red-600 text-red-950 dark:text-red-200',
      dotColor: 'bg-red-600 animate-ping',
      pmVal: 495,
      aqiVal: 500,
    },
  ];

  const controlModes = [
    {
      id: 'ai',
      title: 'Autonomous AI Agent',
      subtitle: 'Multi-variable closed-loop Pareto optimizer',
      icon: Sparkles,
      badge: 'Smart Closed-Loop',
    },
    {
      id: 'bms',
      title: 'Static Rule-Based BMS',
      subtitle: 'Traditional rigid threshold logic',
      icon: Cpu,
      badge: 'Legacy BMS',
    },
    {
      id: 'manual',
      title: 'Manual Parameter Override',
      subtitle: 'Direct discrete radio actuator selection',
      icon: Sliders,
      badge: 'Manual Operator',
    },
  ];

  const handleApplyRoomPreset = (p) => {
    soundEffects.playPop(480);
    setRoomPreset(p.id);
    setRoomVolM3(p.vol);
    setCeilingHeightM(p.height);
    setTargetCO2Max(p.targetCO2);
    setInfiltrationAch(p.ach);
    setOccupancy(p.occ);
  };

  const handleCustomRoomChange = (field, val) => {
    setRoomPreset('custom');
    if (field === 'vol') setRoomVolM3(val);
    if (field === 'height') setCeilingHeightM(val);
    if (field === 'targetCO2') setTargetCO2Max(val);
    if (field === 'ach') setInfiltrationAch(val);
  };

  return (
    <aside className="space-y-4">
      {/* 1. ROOM SPACE & GEOMETRY DETAILS */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              1. Room Space & Geometry Details
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {roomVolM3} m³
          </span>
        </div>

        {/* Room Presets List */}
        <div className="space-y-1.5">
          {roomPresets.map((p) => {
            const isSelected = roomPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyRoomPreset(p)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs relative flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-500 shadow-2xs font-semibold'
                    : 'bg-white/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-indigo-600 dark:border-indigo-400' : 'border-slate-400 dark:border-slate-500'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />}
                </div>
                <div className="space-y-0.5 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{p.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-normal leading-tight">{p.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Editable Custom Specs Inputs Grid */}
        <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-slate-200/70 dark:border-slate-800/80">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400 block">Room Vol (m³)</label>
            <input
              type="number"
              min="50"
              max="3000"
              value={roomVolM3}
              onChange={(e) => handleCustomRoomChange('vol', parseFloat(e.target.value) || 100)}
              className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400 block">Height (m)</label>
            <input
              type="number"
              min="2.0"
              max="8.0"
              step="0.1"
              value={ceilingHeightM}
              onChange={(e) => handleCustomRoomChange('height', parseFloat(e.target.value) || 3.0)}
              className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400 block">Target CO₂ Max</label>
            <input
              type="number"
              min="600"
              max="1500"
              step="50"
              value={targetCO2Max}
              onChange={(e) => handleCustomRoomChange('targetCO2', parseFloat(e.target.value) || 850)}
              className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400 block">Infiltration ACH</label>
            <input
              type="number"
              min="0.02"
              max="0.5"
              step="0.01"
              value={infiltrationAch}
              onChange={(e) => handleCustomRoomChange('ach', parseFloat(e.target.value) || 0.12)}
              className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 2. OUTDOOR AIR QUALITY SCENARIO */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Wind className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              2. Outdoor Air Quality Scenario
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            AMBIENT AQI
          </span>
        </div>

        <div className="space-y-1.5">
          {airScenarios.map((sc) => {
            const isSelected = airScenario === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  soundEffects.playPop(520);
                  setAirScenario(sc.id);
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-start gap-2.5 ${
                  isSelected
                    ? `${sc.activeColor} shadow-2xs font-semibold`
                    : `bg-white/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 hover:bg-white dark:hover:bg-slate-800 ${sc.color}`
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-emerald-600 dark:border-emerald-400' : 'border-slate-400 dark:border-slate-500'
                  }`}
                >
                  {isSelected && <div className={`w-1.5 h-1.5 rounded-full ${sc.dotColor}`} />}
                </div>
                <div className="space-y-0.5 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{sc.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-normal leading-tight">{sc.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. HVAC OPTIMIZATION MODE */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Cpu className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              3. HVAC Optimization Mode
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {controlMode.toUpperCase()}
          </span>
        </div>

        <div className="space-y-1.5">
          {controlModes.map((m) => {
            const isSelected = controlMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  soundEffects.playPop(560);
                  setControlMode(m.id);
                }}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-400 text-emerald-950 dark:text-emerald-200 font-semibold shadow-2xs'
                    : 'bg-white/70 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-emerald-600 dark:border-emerald-400' : 'border-slate-400 dark:border-slate-500'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
                </div>
                <div className="space-y-0.5 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{m.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-normal leading-tight">{m.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Manual Mode Discrete Radio Actuators */}
        {controlMode === 'manual' && (
          <div className="pt-3 mt-3 border-t border-slate-200/70 dark:border-slate-800/80 space-y-3 bg-amber-50/50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/70 dark:border-amber-900/50">
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Manual Damper Opening</span>
                <span className="font-mono font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded text-[11px]">
                  {manualDamper}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 20, 50, 85].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      soundEffects.playPop(440);
                      setManualDamper(val);
                    }}
                    className={`py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                      manualDamper === val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Manual Purifier Fan Speed</span>
                <span className="font-mono font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded text-[11px]">
                  {manualFan}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      soundEffects.playPop(460);
                      setManualFan(val);
                    }}
                    className={`py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                      manualFan === val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. SPACE OCCUPANCY */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
              <Users className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              4. Live Room Occupants
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            {occupancy} PEOPLE
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { val: 0, label: '0 Vacant' },
            { val: 28, label: '28 Normal' },
            { val: 60, label: '60 Packed' },
          ].map((occ) => {
            const isSelected = occupancy === occ.val;
            return (
              <button
                key={occ.val}
                type="button"
                onClick={() => {
                  soundEffects.playPop(420);
                  setOccupancy(occ.val);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {occ.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. GRID ELECTRICITY TARIFF */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              5. Grid Electricity Tariff
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            {isPeakTariff ? '$0.28 / kWh' : '$0.12 / kWh'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              soundEffects.playPop(390);
              setIsPeakTariff(false);
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
              !isPeakTariff
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Off-Peak ($0.12)
          </button>
          <button
            type="button"
            onClick={() => {
              soundEffects.playPop(410);
              setIsPeakTariff(true);
            }}
            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center ${
              isPeakTariff
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            Peak Surge ($0.28)
          </button>
        </div>
      </div>

      {/* 6. HEPA FILTER HEALTH LOADING */}
      <div className="glass-panel rounded-2xl p-4 border border-white/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              6. HEPA Filter Loading State
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            {filterState.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'clean', label: '100% Clean' },
            { id: 'seasoned', label: '65% Loaded' },
            { id: 'clogged', label: '25% Clogged' },
          ].map((item) => {
            const isSelected = filterState === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEffects.playPop(480);
                  setFilterState(item.id);
                }}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all border text-center truncate ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
