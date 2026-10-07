import React from 'react';
import { Sliders, RefreshCw, Zap, CloudRain, ShieldCheck, Flame, Radio } from 'lucide-react';

export default function SimulationControls({
  aqi,
  setAqi,
  humidity,
  setHumidity,
  co2,
  setCo2,
  pm25,
  setPm25,
  temp,
  setTemp,
  isLiveStreaming,
  setIsLiveStreaming,
  onReset,
}) {
  const presets = [
    {
      name: 'Alpine Clean',
      icon: ShieldCheck,
      color: 'hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700',
      apply: () => {
        setAqi(24);
        setHumidity(45);
        setCo2(410);
        setPm25(6);
        setTemp(21);
      },
    },
    {
      name: 'Monsoon Rain',
      icon: CloudRain,
      color: 'hover:border-sky-400 hover:bg-sky-50 text-sky-700',
      apply: () => {
        setAqi(38);
        setHumidity(86);
        setCo2(430);
        setPm25(12);
        setTemp(24);
      },
    },
    {
      name: 'Smog Inversion',
      icon: Flame,
      color: 'hover:border-rose-400 hover:bg-rose-50 text-rose-700',
      apply: () => {
        setAqi(192);
        setHumidity(52);
        setCo2(1050);
        setPm25(82);
        setTemp(28);
      },
    },
    {
      name: 'Wildfire Hazard',
      icon: Zap,
      color: 'hover:border-red-500 hover:bg-red-50 text-red-700',
      apply: () => {
        setAqi(285);
        setHumidity(22);
        setCo2(1380);
        setPm25(145);
        setTemp(35);
      },
    },
  ];

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/80 shadow-sm">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Environmental Simulation Engine</h3>
            <p className="text-xs text-slate-500">Live test reactive thresholds & ambient styling in real-time</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Live Sensor Stream Toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isLiveStreaming
                ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveStreaming ? 'animate-pulse' : ''}`} />
            <span>{isLiveStreaming ? 'Sensor Stream Active' : 'Pause Telemetry'}</span>
          </button>

          <button
            onClick={onReset}
            title="Reset to default sensor baseline"
            className="p-1.5 rounded-xl bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preset Quick Actions */}
      <div className="py-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 mr-1">Presets:</span>
        {presets.map((preset) => {
          const Icon = preset.icon;
          return (
            <button
              key={preset.name}
              onClick={preset.apply}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/70 border border-slate-200 transition-all active:scale-95 shadow-2xs ${preset.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 pt-3">
        {/* AQI Slider */}
        <div className="bg-white/60 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-slate-700">AQI (Index)</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {aqi}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            value={aqi}
            onChange={(e) => setAqi(Number(e.target.value))}
            className="w-full accent-slate-800 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>0 (Pristine)</span>
            <span>150 (Hazard)</span>
            <span>300</span>
          </div>
        </div>

        {/* Humidity Slider */}
        <div className="bg-white/60 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-slate-700">Humidity (% RH)</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {humidity}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={humidity}
            onChange={(e) => setHumidity(Number(e.target.value))}
            className="w-full accent-sky-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>10% (Arid)</span>
            <span>75% (Rain trigger)</span>
            <span>100%</span>
          </div>
        </div>

        {/* PM2.5 Slider */}
        <div className="bg-white/60 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-slate-700">PM2.5 (µg/m³)</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {pm25} µg/m³
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            value={pm25}
            onChange={(e) => setPm25(Number(e.target.value))}
            className="w-full accent-rose-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>0 (Clean)</span>
            <span>55 (Alert)</span>
            <span>150</span>
          </div>
        </div>

        {/* CO2 Slider */}
        <div className="bg-white/60 p-3.5 rounded-xl border border-slate-200/50">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-semibold text-slate-700">CO₂ (ppm)</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {co2} ppm
            </span>
          </div>
          <input
            type="range"
            min="300"
            max="1500"
            step="10"
            value={co2}
            onChange={(e) => setCo2(Number(e.target.value))}
            className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            <span>300 (Fresh)</span>
            <span>1000 (Drowsy)</span>
            <span>1500</span>
          </div>
        </div>
      </div>
    </div>
  );
}
