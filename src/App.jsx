import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navigation/Navbar';
import AeroDashboard from './components/AeroDashboard/AeroDashboard';
import HepaChamber from './components/HepaChamber/HepaChamber';
import GlobalAqiMap from './components/GlobalMap/GlobalAqiMap';
import AuthModal from './components/Auth/AuthModal';
import { getEnvironmentalTheme, THEME_MODES } from './utils/themeEngine';
import { soundEffects } from './utils/soundEffects';
import { fetchZones, fetchLatestTelemetry, fetchTelemetryHistory, fetchAlerts, getApiBaseUrl } from './services/aeroSenseApi';
import { mapBackendTelemetry, extractHistorySparklines } from './utils/telemetryMapper';
import { getSession, onAuthStateChanged } from './services/auth';
import { ShieldAlert, Volume2, VolumeX, Zap, RefreshCw, Radio, Server, AlertCircle } from 'lucide-react';

export default function App() {
  // Mode State: 'simulation' (Local Simulation, default) or 'aws_live' (AWS Live)
  const [mode, setMode] = useState('simulation');
  
  // Custom API URL override if VITE_AEROSENSE_API_URL is missing or customized at runtime
  const [customApiUrl, setCustomApiUrl] = useState('');

  // Environmental Sensor Telemetry State
  const [aqi, setAqi] = useState(32);
  const [humidity, setHumidity] = useState(48);
  const [pm25, setPm25] = useState(8);
  const [co2, setCo2] = useState(415);
  const [temp, setTemp] = useState(22);

  // Additional AWS Live Telemetry & Optimizer State
  const [damperPct, setDamperPct] = useState(20.0);
  const [recommendedDamperPct, setRecommendedDamperPct] = useState(20.0);
  const [fanSpeedPct, setFanSpeedPct] = useState(28.0);
  const [fanPowerKw, setFanPowerKw] = useState(0.85);
  const [filterHealthPct, setFilterHealthPct] = useState(97.2);
  const [currentDpPa, setCurrentDpPa] = useState(130);
  const [cumulativeEnergyKwh, setCumulativeEnergyKwh] = useState(0.08);
  const [cumulativeCostUsd, setCumulativeCostUsd] = useState(0.04);
  const [rationale, setRationale] = useState(
    'Telemetry initialized: Closed-loop multi-variable optimizer balancing indoor particulate, CO₂ accumulation, and fan energy.'
  );
  const [recommendationOnly, setRecommendationOnly] = useState(true);

  // AWS Backend Live History Sparklines & Alerts
  const [sparklines, setSparklines] = useState({
    pm25History: [8.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5],
    co2History: [640, 645, 652, 648, 655, 650, 650],
    powerHistory: [0.82, 0.84, 0.85, 0.83, 0.86, 0.85, 0.85],
    filterHistory: [98.0, 97.8, 97.6, 97.5, 97.4, 97.3, 97.2],
  });
  const [liveAlerts, setLiveAlerts] = useState([]);

  // AWS Live Zone & Network Status State
  const [zones, setZones] = useState([{ zone_id: 'zone-01', name: 'Zone 01 (Main HVAC)' }]);
  const [selectedZone, setSelectedZone] = useState('zone-01');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Auth Modal & Session State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [session, setSession] = useState(null);

  // Navigation & Streaming State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(true);

  // In-flight Polling Guard Ref
  const isPollingRef = useRef(false);

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

  // Auth Listener
  useEffect(() => {
    getSession().then((s) => setSession(s)).catch(() => setSession(null));
    const unsubscribe = onAuthStateChanged((s) => setSession(s));
    return () => unsubscribe();
  }, []);

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

  // Local Simulation IoT Stream (ONLY active when mode === 'simulation' and isLiveStreaming is true)
  useEffect(() => {
    if (mode !== 'simulation' || !isLiveStreaming) return;

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
        const delta = Math.random() * 0.4 - 0.2;
        return Number(Math.max(16, Math.min(38, prev + delta)).toFixed(1));
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [mode, isLiveStreaming]);

  // AWS Live Fetch Helper (Single-shot poll)
  const fetchAwsLiveData = useCallback(async (isInitial = false) => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    if (isInitial) {
      setIsApiLoading(true);
    }

    try {
      // 1. Fetch Zones if needed
      let currentZones = zones;
      try {
        const fetchedZones = await fetchZones(customApiUrl);
        if (fetchedZones && fetchedZones.length > 0) {
          currentZones = fetchedZones;
          setZones(fetchedZones);
          // If selected zone isn't in current list, pick first
          if (!fetchedZones.some((z) => z.zone_id === selectedZone)) {
            setSelectedZone(fetchedZones[0].zone_id);
          }
        }
      } catch (zoneErr) {
        console.warn('Zone fetch warning:', zoneErr.message);
      }

      const activeZoneId = selectedZone || (currentZones[0] ? currentZones[0].zone_id : 'zone-01');

      // 2. Fetch Latest Telemetry for selected zone
      const rawTelemetry = await fetchLatestTelemetry(activeZoneId, customApiUrl);
      
      // Map telemetry using strict mapper
      const mapped = mapBackendTelemetry(rawTelemetry, {
        aqi,
        pm25,
        temp,
        humidity,
        co2,
        damperPct,
        fanSpeedPct,
        fanPowerKw,
        filterHealthPct,
        currentDpPa,
        cumulativeEnergyKwh,
        cumulativeCostUsd,
        selectedZone: activeZoneId,
      });

      // Update Live State
      setAqi(mapped.aqi);
      setPm25(mapped.pm25);
      setTemp(mapped.temp);
      setHumidity(mapped.humidity);
      setCo2(mapped.co2);
      setDamperPct(mapped.damperPct);
      setRecommendedDamperPct(mapped.recommendedDamperPct);
      setFanSpeedPct(mapped.fanSpeedPct);
      setFanPowerKw(mapped.fanPowerKw);
      setFilterHealthPct(mapped.filterHealthPct);
      setCurrentDpPa(mapped.currentDpPa);
      setCumulativeEnergyKwh(mapped.cumulativeEnergyKwh);
      setCumulativeCostUsd(mapped.cumulativeCostUsd);
      setRationale(mapped.rationale);
      setRecommendationOnly(mapped.recommendationOnly);

      // 3. Fetch History Sparklines
      try {
        const historyRecords = await fetchTelemetryHistory(activeZoneId, 50, customApiUrl);
        if (historyRecords && historyRecords.length > 0) {
          const sparkData = extractHistorySparklines(historyRecords, sparklines);
          setSparklines(sparkData);
        }
      } catch (histErr) {
        console.warn('History fetch warning:', histErr.message);
      }

      // 4. Fetch Active Alerts
      try {
        const alertRecords = await fetchAlerts(activeZoneId, 20, customApiUrl);
        setLiveAlerts(alertRecords);
      } catch (alertErr) {
        console.warn('Alerts fetch warning:', alertErr.message);
      }

      // Mark clean success
      setApiError(null);
      setIsStale(false);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('AWS Live fetch error:', err.message);
      setApiError(err.message || 'Failed to connect to AWS BuildingTelemetry API.');
      setIsStale(true);
      // NOTE: We deliberately DO NOT reset current live values to random defaults on failure!
    } finally {
      setIsApiLoading(false);
      isPollingRef.current = false;
    }
  }, [selectedZone, customApiUrl, zones, aqi, pm25, temp, humidity, co2, damperPct, fanSpeedPct, fanPowerKw, filterHealthPct, currentDpPa, cumulativeEnergyKwh, cumulativeCostUsd, sparklines]);

  // AWS Live Mode Polling Loop (Polls every 12 seconds when mode === 'aws_live')
  useEffect(() => {
    if (mode !== 'aws_live') return;

    // Trigger immediate initial fetch
    fetchAwsLiveData(true);

    // Setup 12-second polling interval
    const interval = setInterval(() => {
      fetchAwsLiveData(false);
    }, 12000);

    return () => {
      clearInterval(interval);
      isPollingRef.current = false;
    };
  }, [mode, selectedZone, customApiUrl]);

  const handleReset = () => {
    if (mode === 'aws_live') {
      fetchAwsLiveData(true);
      return;
    }
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

  // Rain droplets calculation
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
      {/* 1. Flashing Hazard Perimeter Strobe */}
      {showScreenStrobe && (
        <div className="fixed inset-0 pointer-events-none z-50 hazard-active-border" />
      )}

      {/* Rain Droplets Overlay */}
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
        {/* 2. Hazard Alert Banner */}
        {isHazard && (
          <div
            className={`w-full rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl border-2 mb-4 flex flex-col md:flex-row items-center justify-between gap-3.5 transition-all ${
              showScreenStrobe ? 'alert-flash-banner border-white/80' : 'bg-slate-900/90 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div
                className={`p-2 rounded-xl shrink-0 shadow-md ${
                  showScreenStrobe ? 'bg-white text-rose-600 animate-bounce' : 'bg-slate-800 text-amber-400'
                }`}
              >
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`font-black text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      showScreenStrobe
                        ? 'bg-black/40 text-white border-white/30'
                        : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}
                  >
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

        {/* 3. AWS Connection & Stale Error Banner */}
        {mode === 'aws_live' && apiError && (
          <div className="w-full rounded-2xl p-3 sm:p-4 bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-extrabold uppercase tracking-wide">AWS API Connection Notice: </span>
                <span>{apiError} Retaining last valid live telemetry readings.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => fetchAwsLiveData(true)}
                disabled={isApiLoading}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isApiLoading ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-sm"
              >
                Configure Auth
              </button>
            </div>
          </div>
        )}

        {/* 4. Universal Navigation & Mode Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          theme={theme}
          aqi={aqi}
          humidity={humidity}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          mode={mode}
          setMode={setMode}
          zones={zones}
          selectedZone={selectedZone}
          setSelectedZone={setSelectedZone}
          isApiLoading={isApiLoading}
          isStale={isStale}
          lastUpdated={lastUpdated}
          session={session}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
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
              damperPct={damperPct}
              setDamperPct={setDamperPct}
              recommendedDamperPct={recommendedDamperPct}
              fanSpeedPct={fanSpeedPct}
              setFanSpeedPct={setFanSpeedPct}
              fanPowerKw={fanPowerKw}
              filterHealthPct={filterHealthPct}
              currentDpPa={currentDpPa}
              cumulativeEnergyKwh={cumulativeEnergyKwh}
              cumulativeCostUsd={cumulativeCostUsd}
              rationale={rationale}
              recommendationOnly={recommendationOnly}
              sparklines={sparklines}
              liveAlerts={liveAlerts}
              mode={mode}
              selectedZone={selectedZone}
              isApiLoading={isApiLoading}
              isStale={isStale}
              lastUpdated={lastUpdated}
              onRetry={() => fetchAwsLiveData(true)}
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

        {/* Auth Modal for Cognito Sign In & Settings */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={() => fetchAwsLiveData(true)}
          customApiUrl={customApiUrl}
          setCustomApiUrl={setCustomApiUrl}
        />

        {/* Global Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-sm">Built by 80085</span>
            <span className="text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              Company Trademark
            </span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span className="font-medium">
              AeroSense Environmental Intelligence Engine {mode === 'aws_live' ? '(AWS Live Connected)' : '(Local Simulation)'}
            </span>
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
