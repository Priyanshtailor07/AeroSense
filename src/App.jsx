import React, { useState, useEffect } from 'react';
import Navbar from './components/Navigation/Navbar';
import AeroDashboard from './components/AeroDashboard/AeroDashboard';
import HepaChamber from './components/HepaChamber/HepaChamber';
import GlobalAqiMap from './components/GlobalMap/GlobalAqiMap';
import { getEnvironmentalTheme, THEME_MODES } from './utils/themeEngine';
import { soundEffects } from './utils/soundEffects';
import { ShieldAlert, Volume2, VolumeX, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export default function App() {
  // Environmental Sensor Telemetry State
  const [aqi, setAqi] = useState(32);
  const [humidity, setHumidity] = useState(48);
  const [pm25, setPm25] = useState(8);
  const [co2, setCo2] = useState(415);
  const [temp, setTemp] = useState(22);

  // Navigation & Streaming State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(true);

  // Dark / Light Theme Mode State with persistence
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aerosense_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('aerosense_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('aerosense_theme', 'light');
    }
  }, [isDarkMode]);

  // Dynamic Ambient Theme based on strict priority
  const isHazard = aqi > 150 || pm25 > 55;
  const theme = getEnvironmentalTheme(aqi, humidity, pm25);

  // Re-arm alarm if AQI becomes clean then rises again
  useEffect(() => {
    if (!isHazard) {
      setIsAlarmActive(true);
      setIsAlarmMuted(false);
      soundEffects.enableAlarm();
    }
  }, [isHazard]);

  // Trigger audio alarm if in active hazard mode
  useEffect(() => {
    if (isHazard && isAlarmActive && !isAlarmMuted) {
      soundEffects.playHazardAlarm();
    }
  }, [isHazard, isAlarmActive, isAlarmMuted, aqi]);

  // Simulated IoT Stream (fluctuates values slightly every 2 seconds when active)
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setAqi((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(5, Math.min(295, prev + delta));
      });
      setPm25((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(1, Math.min(145, prev + delta));
      });
      setHumidity((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(15, Math.min(95, prev + delta));
      });
      setCo2((prev) => {
        const delta = Math.floor(Math.random() * 9) - 4;
        return Math.max(320, Math.min(1480, prev + delta));
      });
      setTemp((prev) => {
        const delta = (Math.random() * 0.4 - 0.2);
        return Number((Math.max(16, Math.min(38, prev + delta))).toFixed(1));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const handleReset = () => {
    setAqi(32);
    setHumidity(48);
    setPm25(8);
    setCo2(415);
    setTemp(22);
    setIsAlarmActive(true);
    setIsAlarmMuted(false);
    soundEffects.enableAlarm();
    soundEffects.playPop(480);
  };

  const handleSyncTelemetryFromMap = (data) => {
    if (data.aqi !== undefined) setAqi(data.aqi);
    if (data.humidity !== undefined) setHumidity(data.humidity);
    if (data.pm25 !== undefined) setPm25(data.pm25);
    if (data.temp !== undefined) setTemp(data.temp);
    if (data.co2 !== undefined) setCo2(data.co2);
  };

  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    setIsAlarmMuted(true);
    soundEffects.stopHazardAlarm();
    soundEffects.playPop(360);
  };

  const handleReenableAlarm = () => {
    setIsAlarmActive(true);
    setIsAlarmMuted(false);
    soundEffects.enableAlarm();
    soundEffects.playHazardAlarm();
  };

  // Generate rain drops when in rain mode
  const rainDrops = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: `${(i * 2.8) % 100}%`,
    duration: `${0.75 + (i % 6) * 0.18}s`,
    delay: `${(i % 12) * 0.12}s`,
  }));

  const showScreenStrobe = isHazard && isAlarmActive && !isAlarmMuted;
  const currentBgGradient = isDarkMode ? theme.darkBgGradient : theme.bgGradient;
  const currentTextColor = isDarkMode ? 'text-slate-100' : 'text-slate-900';

  return (
    <div className={`min-h-screen bg-gradient-to-br ${currentBgGradient} transition-all duration-700 relative overflow-x-hidden p-3 sm:p-6 ${currentTextColor}`}>
      {/* 1. Dynamic Flashing Screen Perimeter Hazard Strobe (Turns OFF completely when alarm is stopped) */}
      {showScreenStrobe && (
        <div className="fixed inset-0 pointer-events-none z-50 hazard-active-border" />
      )}

      {/* Dynamic Rain Droplets Layer when in Rain/Moist mode */}
      {theme.mode === THEME_MODES.RAIN && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {rainDrops.map((drop) => (
            <div
              key={drop.id}
              className="rain-drop"
              style={{
                left: drop.left,
                animationDuration: drop.duration,
                animationDelay: drop.delay,
              }}
            />
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* 2. Seamless Hazard Alert Banner */}
        {isHazard && (
          <div className={`w-full rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl border-2 mb-4 flex flex-col md:flex-row items-center justify-between gap-3.5 transition-all ${
            showScreenStrobe 
              ? 'alert-flash-banner border-white/80' 
              : 'bg-slate-900/90 border-slate-700'
          }`}>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className={`p-2 rounded-xl shrink-0 shadow-md ${
                showScreenStrobe ? 'bg-white text-rose-600 animate-bounce' : 'bg-slate-800 text-amber-400'
              }`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-black text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    showScreenStrobe ? 'bg-black/40 text-white border-white/30' : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}>
                    {showScreenStrobe ? '🚨 ACTIVE BIO-HAZARD ALARM' : '⚠️ HIGH AQI (ALARM STOPPED)'}
                  </span>
                  <span className="text-xs font-mono font-bold bg-white text-rose-700 px-2.5 py-0.5 rounded-full shadow-xs">
                    AQI {aqi} • PM2.5 {pm25} µg/m³
                  </span>
                </div>
                <p className={`text-xs font-medium ${showScreenStrobe ? 'text-rose-100' : 'text-slate-300'}`}>
                  {showScreenStrobe 
                    ? 'Hazard audio siren and screen strobe active. Click STOP ALARM to silence and dismiss strobe.' 
                    : 'Hazard strobe and siren stopped. HEPA chamber filtration recommended.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
              {showScreenStrobe ? (
                <button
                  onClick={handleStopAlarm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-white text-rose-950 hover:bg-rose-100 shadow-xl border-2 border-rose-400 active:scale-95 transition animate-pulse"
                  title="Stop alarm, silence audio, and remove red screen strobe"
                >
                  <VolumeX className="w-4 h-4 text-rose-600" />
                  <span>🛑 STOP ALARM</span>
                </button>
              ) : (
                <button
                  onClick={handleReenableAlarm}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-95 transition"
                  title="Turn alarm back on"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>🔊 Re-enable Alarm</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('hepa')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-white text-rose-950 hover:bg-rose-100 shadow-md active:scale-95 transition shrink-0"
              >
                <Zap className="w-4 h-4 text-rose-600" />
                <span>Engage HEPA 3D</span>
              </button>
            </div>
          </div>
        )}
        {/* Universal Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          theme={theme}
          aqi={aqi}
          humidity={humidity}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />

        {/* Tab Modules */}
        <main className="transition-opacity duration-300">
          {activeTab === 'dashboard' && (
            <AeroDashboard
              theme={theme}
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
              onReset={handleReset}
              onOpenHepa={() => setActiveTab('hepa')}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'hepa' && <HepaChamber />}

          {activeTab === 'earthmap' && (
            <GlobalAqiMap
              onSyncTelemetry={handleSyncTelemetryFromMap}
              isAlarmMuted={isAlarmMuted}
              setIsAlarmMuted={setIsAlarmMuted}
              isAlarmActive={isAlarmActive}
              onStopAlarm={handleStopAlarm}
              onReenableAlarm={handleReenableAlarm}
            />
          )}
        </main>

        {/* Global Footer with Company Trademark */}
        <footer className="mt-12 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm">Built by 80085</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              Company Trademark
            </span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span className="font-medium">AeroSense Planetary Environmental Intelligence Engine</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 font-mono text-[11px] font-bold">
            <span>© 2026 Built by 80085</span>
            <span>•</span>
            <span>All Rights Reserved</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
