import React from 'react';
import { Wind, Droplets, Thermometer, Flame, Activity, ShieldCheck, Eye } from 'lucide-react';
import AmbientAlertBar from './AmbientAlertBar';
import MetricCard from './MetricCard';
import EarthGlobe3D from './EarthGlobe3D';
import SimulationControls from './SimulationControls';
import ScientificOverview from './ScientificOverview';
import { THEME_MODES } from '../../utils/themeEngine';

export default function AeroDashboard({
  theme,
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
  onOpenHepa,
}) {
  // Sparkline history simulations based on current values
  const aqiHistory = [aqi - 8, aqi - 4, aqi - 6, aqi + 3, aqi - 2, aqi + 5, aqi];
  const humHistory = [humidity - 2, humidity - 1, humidity + 3, humidity - 1, humidity, humidity + 2, humidity];
  const pm25History = [pm25 - 5, pm25 - 2, pm25 - 4, pm25 + 3, pm25 + 1, pm25 - 2, pm25];
  const co2History = [co2 - 40, co2 - 20, co2 - 30, co2 + 15, co2 + 5, co2 - 10, co2];

  const getAqiBadge = (val) => {
    if (val <= 50) return { label: 'Good (0-50)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (val <= 100) return { label: 'Moderate (51-100)', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    if (val <= 150) return { label: 'Sensitive (101-150)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: 'Hazardous (151+)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  };

  const getPm25Badge = (val) => {
    if (val <= 12) return { label: 'Pristine (≤12)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (val <= 35) return { label: 'Acceptable (12-35)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (val <= 55) return { label: 'Elevated (35-55)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: 'Extreme (>55)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  };

  const aqiBadgeInfo = getAqiBadge(aqi);
  const pm25BadgeInfo = getPm25Badge(pm25);

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Ambient Status Banner */}
      <AmbientAlertBar
        theme={theme}
        aqi={aqi}
        humidity={humidity}
        pm25={pm25}
        onOpenHepa={onOpenHepa}
      />

      {/* 2. Primary Metrics & 3D Earth Globe Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Metric Cards Grid (8 cols on lg) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* AQI Metric Card */}
          <MetricCard
            title="Air Quality Index"
            value={aqi}
            unit="AQI"
            latexUnit="AQI"
            icon={Wind}
            badge={aqiBadgeInfo.label}
            badgeColor={aqiBadgeInfo.color}
            min={0}
            max={300}
            history={aqiHistory}
            accentColor={theme.primaryHex}
            description="Overall EPA composite rating"
          />

          {/* PM2.5 Metric Card */}
          <MetricCard
            title="PM2.5 Density"
            value={pm25}
            unit="µg/m³"
            latexUnit="µg/m³"
            icon={Flame}
            badge={pm25BadgeInfo.label}
            badgeColor={pm25BadgeInfo.color}
            min={0}
            max={150}
            history={pm25History}
            accentColor="#ef4444"
            description="Fine respirable particles"
          />

          {/* Relative Humidity Card */}
          <MetricCard
            title="Relative Humidity"
            value={humidity}
            unit="% RH"
            latexUnit="% RH"
            icon={Droplets}
            badge={humidity > 75 ? 'Rain / Moist' : humidity < 30 ? 'Dry / Arid' : 'Ideal Comfort'}
            badgeColor={humidity > 75 ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}
            min={10}
            max={100}
            history={humHistory}
            accentColor="#0ea5e9"
            description={humidity > 75 ? 'Precipitation active' : 'Comfort envelope (40-60%)'}
          />

          {/* Carbon Dioxide Card */}
          <MetricCard
            title="Carbon Dioxide"
            value={co2}
            unit="ppm"
            latexUnit="ppm"
            icon={Activity}
            badge={co2 > 1000 ? 'Ventilate Room' : 'Normal Indoor'}
            badgeColor={co2 > 1000 ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}
            min={300}
            max={1500}
            history={co2History}
            accentColor="#10b981"
            description="NDIR optical sensor feed"
          />

          {/* Secondary Metric: Temperature */}
          <div className="glass-card rounded-2xl p-4 border border-white/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Ambient Temp</span>
                <div className="text-lg font-bold font-mono text-slate-800">{temp}°C / {((temp * 9) / 5 + 32).toFixed(1)}°F</div>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Optimal
            </span>
          </div>

          {/* Secondary Metric: HEPA Filter Life & Trapping */}
          <div 
            onClick={onOpenHepa}
            className="glass-card rounded-2xl p-4 border border-white/70 flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:bg-white/80 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">HEPA H13 Media</span>
                <div className="text-lg font-bold font-mono text-slate-800">99.97% Efficiency</div>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Inspect 3D</span>
            </span>
          </div>
        </div>

        {/* 3D Earth Atmospheric Globe Widget (4 cols on lg) */}
        <div className="lg:col-span-4 h-full">
          <EarthGlobe3D
            aqi={aqi}
            pm25={pm25}
            theme={theme}
          />
        </div>
      </div>

      {/* 3. Interactive Real-Time Simulation Controls */}
      <SimulationControls
        aqi={aqi}
        setAqi={setAqi}
        humidity={humidity}
        setHumidity={setHumidity}
        co2={co2}
        setCo2={setCo2}
        pm25={pm25}
        setPm25={setPm25}
        temp={temp}
        setTemp={setTemp}
        isLiveStreaming={isLiveStreaming}
        setIsLiveStreaming={setIsLiveStreaming}
        onReset={onReset}
      />

      {/* 4. Scientific & Mathematical Standards Matrix */}
      <ScientificOverview />
    </div>
  );
}
