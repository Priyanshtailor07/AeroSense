import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navigation/Navbar';
import AeroDashboard from './components/AeroDashboard/AeroDashboard';
import HepaChamber from './components/HepaChamber/HepaChamber';
import GlobalAqiMap from './components/GlobalMap/GlobalAqiMap';
import { getEnvironmentalTheme, THEME_MODES } from './utils/themeEngine';
import { soundEffects } from './utils/soundEffects';
import { fetchZones, fetchLatestTelemetry, fetchTelemetryHistory, fetchAlerts } from './services/aeroSenseApi';
import { mapBackendTelemetry, extractHistorySparklines, UNPUBLISHED_METRICS } from './utils/telemetryMapper';
import { useAuth } from './context/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { ShieldAlert, Volume2, VolumeX, Zap, RefreshCw, AlertCircle, ShieldOff, Info } from 'lucide-react';

/** How often AWS Live re-polls the backend. */
const POLL_INTERVAL_MS = 12_000;

export default function App() {
  const { session, logout, isVerified, isBusy: isAuthBusy } = useAuth();

  // Operational mode. An authenticated operator lands on AWS Live; 'simulation'
  // is an explicitly chosen, clearly labelled demo mode that never feeds the
  // AWS Live readings.
  const [mode, setMode] = useState('aws_live');

  // Environmental Sensor Telemetry State
  const [aqi, setAqi] = useState(32);
  const [humidity, setHumidity] = useState(48);
  const [pm25, setPm25] = useState(8);
  const [co2, setCo2] = useState(415);
  const [temp, setTemp] = useState(22);
  /** Metric keys the API did not supply for the current record. */
  const [unavailableMetrics, setUnavailableMetrics] = useState([]);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  // Additional AWS Live Telemetry & Optimizer State.
  // The five metrics the BuildingTelemetry API does not publish start as null
  // so AWS Live never shows a default dressed up as a live reading.
  const [damperPct, setDamperPct] = useState(null);
  const [recommendedDamperPct, setRecommendedDamperPct] = useState(null);
  const [fanSpeedPct, setFanSpeedPct] = useState(null);
  const [fanPowerKw, setFanPowerKw] = useState(null);
  const [filterHealthPct, setFilterHealthPct] = useState(null);
  const [currentDpPa, setCurrentDpPa] = useState(null);
  const [cumulativeEnergyKwh, setCumulativeEnergyKwh] = useState(null);
  const [cumulativeCostUsd, setCumulativeCostUsd] = useState(null);
  const [outdoorPm25, setOutdoorPm25] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [telemetrySource, setTelemetrySource] = useState(null);
  const [telemetryTimestampMs, setTelemetryTimestampMs] = useState(null);
  const [rationale, setRationale] = useState(null);
  const [recommendationOnly, setRecommendationOnly] = useState(true);

  // AWS Backend Live History Sparklines & Alerts
  const [sparklines, setSparklines] = useState({
    pm25History: [],
    co2History: [],
    powerHistory: [],
    filterHistory: [],
    aqiHistory: [],
  });
  const [liveAlerts, setLiveAlerts] = useState([]);

  // AWS Live zone & network status. Zones start empty: the real list comes from
  // the protected /zones endpoint, never from a hardcoded guess.
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [apiErrorKind, setApiErrorKind] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  /** True once a protected fetch has delivered real telemetry for this session. */
  const [hasLiveData, setHasLiveData] = useState(false);

  // Navigation & Streaming State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(true);

  // Request bookkeeping. `requestSeqRef` stamps every poll so a slow response
  // from an earlier poll (or an earlier zone) can be recognised as stale and
  // dropped instead of overwriting newer readings.
  const requestSeqRef = useRef(0);
  const latestAppliedSeqRef = useRef(0);
  const abortRef = useRef(null);

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
  const isHazard = (aqi ?? 0) > 150 || (pm25 ?? 0) > 55;
  const theme = getEnvironmentalTheme(aqi ?? 0, humidity ?? 0, pm25 ?? 0);

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

  // Local simulation stream. Gated on mode === 'simulation', so simulated values
  // can never be written over AWS Live readings.
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

  /** Mirror of selectedZone, read by the stale-response check below. */
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;

  /**
   * Fetch one complete AWS Live snapshot for `zoneId`.
   *
   * Ordering guarantee: each call takes a sequence number. Results are applied
   * only if no newer call has already applied its results *and* the response
   * still belongs to the zone currently selected. That makes it impossible for
   * a slow in-flight request to clobber newer readings or another zone's data.
   */
  const fetchAwsLiveData = useCallback(
    async (zoneId, { isInitial = false, signal } = {}) => {
      const seq = ++requestSeqRef.current;
      if (isInitial) setIsApiLoading(true);

      /** Is this response still the newest one for the zone we are showing? */
      const isCurrent = () =>
        !signal?.aborted && seq > latestAppliedSeqRef.current && zoneId === selectedZoneRef.current;

      try {
        const rawTelemetry = await fetchLatestTelemetry(zoneId, { signal });
        if (!isCurrent()) return;

        const mapped = mapBackendTelemetry(rawTelemetry);
        if (!mapped) {
          throw new Error('The API returned a telemetry record that could not be read.');
        }
        if (!isCurrent()) return;

        latestAppliedSeqRef.current = seq;

        // Applied exactly as received. A field the API omitted becomes null and
        // is listed in `missing`, never backfilled from a previous reading.
        setAqi(mapped.aqi);
        setPm25(mapped.pm25);
        setOutdoorPm25(mapped.outdoorPm25);
        setTemp(mapped.temp);
        setHumidity(mapped.humidity);
        setCo2(mapped.co2);
        setOccupancy(mapped.occupancy);
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
        setTelemetrySource(mapped.source);
        setTelemetryTimestampMs(mapped.timestampMs);
        setUnavailableMetrics(mapped.missing || []);

        setApiError(null);
        setApiErrorKind(null);
        setIsStale(false);
        setHasLiveData(true);
        setLastUpdated(new Date().toLocaleTimeString());

        // History and alerts are supplementary: a failure there marks the panel
        // empty rather than discarding the telemetry we just applied.
        const [history, alerts] = await Promise.allSettled([
          fetchTelemetryHistory(zoneId, 20, { signal }),
          fetchAlerts(zoneId, 20, { signal }),
        ]);

        if (!isCurrent() && seq !== latestAppliedSeqRef.current) return;

        if (history.status === 'fulfilled') {
          setSparklines(extractHistorySparklines(history.value));
        } else if (history.reason?.name !== 'AbortError') {
          console.warn('History unavailable:', history.reason?.message);
          setSparklines({ pm25History: [], co2History: [], powerHistory: [], filterHistory: [], aqiHistory: [] });
        }

        if (alerts.status === 'fulfilled') {
          setLiveAlerts(alerts.value);
        } else if (alerts.reason?.name !== 'AbortError') {
          console.warn('Alerts unavailable:', alerts.reason?.message);
          setLiveAlerts([]);
        }
      } catch (err) {
        if (err?.name === 'AbortError' || signal?.aborted) return;
        if (zoneId !== selectedZoneRef.current) return;

        // An unrecoverable 401 has already cleared the session; the guard will
        // swap in the login screen, so there is nothing to show here.
        if (err?.kind === 'AUTH') return;

        console.error('AWS Live fetch failed:', err?.message);
        setApiError(err?.message || 'Could not reach the AeroSense API.');
        setApiErrorKind(err?.kind || 'SERVER');
        setIsStale(true);
        // Last known good readings are retained and flagged STALE. They are
        // never replaced with simulated values.
      } finally {
        if (!signal?.aborted) setIsApiLoading(false);
      }
    },
    []
  );

  // Resolve the authoritative zone list once per session from /zones.
  useEffect(() => {
    if (mode !== 'aws_live') return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setIsApiLoading(true);
      try {
        const list = await fetchZones({ signal: controller.signal });
        if (cancelled) return;
        setZones(list);
        setSelectedZone((prev) => {
          if (prev && list.some((z) => z.zone_id === prev)) return prev;
          return list.length > 0 ? list[0].zone_id : null;
        });
        if (list.length === 0) {
          setApiError('The AeroSense API returned no zones for this account.');
          setApiErrorKind('EMPTY');
          setIsApiLoading(false);
        }
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        if (err?.kind === 'AUTH') return;
        setApiError(err?.message || 'Could not load the zone list.');
        setApiErrorKind(err?.kind || 'SERVER');
        setIsStale(true);
        setIsApiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode]);

  // Poll the selected zone. Changing zone tears down the previous cycle, which
  // aborts its in-flight requests so they cannot land late.
  useEffect(() => {
    if (mode !== 'aws_live' || !selectedZone) return;

    const controller = new AbortController();
    abortRef.current = controller;

    fetchAwsLiveData(selectedZone, { isInitial: true, signal: controller.signal });
    const interval = setInterval(() => {
      fetchAwsLiveData(selectedZone, { signal: controller.signal });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [mode, selectedZone, fetchAwsLiveData]);

  /** Switching zone clears the previous zone's supplementary panels at once. */
  const handleSelectZone = useCallback((zoneId) => {
    if (zoneId === selectedZoneRef.current) return;
    abortRef.current?.abort();
    setSelectedZone(zoneId);
    setLiveAlerts([]);
    setSparklines({ pm25History: [], co2History: [], powerHistory: [], filterHistory: [], aqiHistory: [] });
    setHasLiveData(false);
    setIsStale(false);
    setApiError(null);
    setApiErrorKind(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (!selectedZoneRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    fetchAwsLiveData(selectedZoneRef.current, { isInitial: true, signal: controller.signal });
  }, [fetchAwsLiveData]);

  const handleLogout = useCallback(async () => {
    // Stop authenticated polling and cancel outstanding protected requests
    // before the session goes away.
    abortRef.current?.abort();
    abortRef.current = null;
    requestSeqRef.current = 0;
    latestAppliedSeqRef.current = 0;
    setZones([]);
    setSelectedZone(null);
    setLiveAlerts([]);
    setSparklines({ pm25History: [], co2History: [], powerHistory: [], filterHistory: [], aqiHistory: [] });
    setHasLiveData(false);
    setApiError(null);
    setApiErrorKind(null);
    setLastUpdated(null);
    soundEffects.stopHazardAlarm();
    await logout();
  }, [logout]);

  const handleReset = () => {
    if (mode === 'aws_live') {
      handleRetry();
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
    // Pulling a station's readings into the dashboard is a simulation feature.
    // Allowing it in AWS Live would overwrite genuine AWS telemetry.
    if (mode === 'aws_live') return;
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
    <div className={`min-h-screen bg-gradient-to-br ${currentBgGradient} transition-all duration-700 relative overflow-x-hidden px-3 sm:px-6 py-3 sm:py-5 ${currentTextColor}`}>
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

      <div className="max-w-7xl mx-auto relative z-10 min-w-0">
        {/* 2. Hazard Alert Banner */}
        {isHazard && (
          <div
            className={`w-full rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl border-2 mb-3 flex flex-col md:flex-row items-center justify-between gap-3.5 transition-all ${
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
                    {showScreenStrobe ? 'Air quality hazard' : 'Air quality hazard · alarm muted'}
                  </span>
                  <span className="text-xs font-mono font-bold bg-white text-rose-700 px-2.5 py-0.5 rounded-full shadow-xs">
                    AQI {aqi} • PM2.5 {pm25} µg/m³
                  </span>
                </div>
                <p className={`text-xs font-medium ${showScreenStrobe ? 'text-rose-100' : 'text-slate-300'}`}>
                  {showScreenStrobe
                    ? 'This browser alarm is advisory. Muting it changes nothing on the HVAC equipment.'
                    : 'Browser alarm muted. The hazard reading is unchanged; AeroSense issues recommendations only.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
              {showScreenStrobe ? (
                <button
                  onClick={handleStopAlarm}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-white text-rose-950 hover:bg-rose-100 shadow-xl border-2 border-rose-400 active:scale-95 transition animate-pulse"
                  title="Mute the browser alarm sound and strobe. This does not change any equipment."
                >
                  <VolumeX className="w-4 h-4 text-rose-600" />
                  <span>Mute alarm</span>
                </button>
              ) : (
                <button
                  onClick={handleReenableAlarm}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 active:scale-95 transition"
                  title="Unmute the browser alarm"
                >
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Unmute alarm</span>
                </button>
              )}

              <button
                onClick={() => setActiveTab('hepa')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-white text-rose-950 hover:bg-rose-100 shadow-md active:scale-95 transition shrink-0"
              >
                <Zap className="w-4 h-4 text-rose-600" />
                <span>View 3D HEPA model</span>
              </button>
            </div>
          </div>
        )}

        {/* 3a. Simulation mode is demo data and says so unmistakably. */}
        {mode === 'simulation' && (
          <div className="w-full rounded-2xl p-3 bg-indigo-500/10 border border-indigo-500/40 text-indigo-900 dark:text-indigo-200 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldOff className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-xs">
                <span className="font-extrabold uppercase tracking-wide">Local Simulation Mode — </span>
                <span>
                  These readings are generated on this device for demonstration. They are not AWS telemetry.
                </span>
              </div>
            </div>
            <button
              onClick={() => setMode('aws_live')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition shrink-0"
            >
              Switch to AWS Live
            </button>
          </div>
        )}

        {/* 3b. AWS Connection & Stale Error Banner */}
        {mode === 'aws_live' && apiError && (
          <div className="w-full rounded-2xl p-3 sm:p-4 bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-extrabold uppercase tracking-wide">
                  {apiErrorKind === 'FORBIDDEN'
                    ? 'Access Denied: '
                    : apiErrorKind === 'NETWORK'
                    ? 'Network / CORS Failure: '
                    : apiErrorKind === 'TIMEOUT'
                    ? 'Request Timed Out: '
                    : apiErrorKind === 'EMPTY'
                    ? 'No Data: '
                    : apiErrorKind === 'NOT_FOUND'
                    ? 'Endpoint Missing: '
                    : 'AWS API Connection Notice: '}
                </span>
                <span>
                  {apiError}
                  {hasLiveData
                    ? ' Showing the last readings received from AWS; they are no longer current.'
                    : ' No AWS telemetry has been received for this zone.'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRetry}
                disabled={isApiLoading}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isApiLoading ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
              {apiErrorKind === 'FORBIDDEN' && (
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs shadow-sm"
                >
                  Sign in as another user
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3c. Which metrics the API does not publish. Compact and dismissible:
                each card already shows N/A, so a permanent banner is noise. */}
        {mode === 'aws_live' && hasLiveData && !noticeDismissed && unavailableMetrics.length > 0 && (
          <div className="w-full rounded-xl px-3 py-2 bg-slate-500/10 border border-slate-400/30 text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <p className="text-[11px] leading-snug min-w-0 flex-1">
              <span className="font-bold">Shown as N/A</span> — not published by this API:{' '}
              {UNPUBLISHED_METRICS.filter((m) => unavailableMetrics.includes(m.key))
                .map((m) => m.label)
                .join(', ')}
              .
            </p>
            <button
              onClick={() => setNoticeDismissed(true)}
              className="shrink-0 text-[11px] font-bold hover:underline focus:outline-none focus:ring-2 focus:ring-slate-400 rounded px-1"
            >
              Dismiss
            </button>
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
          setSelectedZone={handleSelectZone}
          isApiLoading={isApiLoading}
          isStale={isStale}
          lastUpdated={lastUpdated}
          session={session}
          isVerified={isVerified}
          isAuthBusy={isAuthBusy}
          onSignOut={handleLogout}
        />

        {/* Tab Modules */}
        <main className="transition-opacity duration-300 space-y-5">
          {/* AWS Live holds the dashboard behind a loading state until genuine
              telemetry has arrived, so no card is ever populated with a
              placeholder reading. */}
          {activeTab === 'dashboard' && mode === 'aws_live' && !hasLiveData && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-10 flex flex-col items-center justify-center gap-3 text-center shadow-sm">
              {isApiLoading ? (
                <>
                  <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Loading AWS telemetry{selectedZone ? ` for ${selectedZone}` : ''}…
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Reading the protected BuildingTelemetry endpoints.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    No AWS telemetry available
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                    {apiError || 'The API returned no readings for this zone.'}
                  </p>
                  <button
                    onClick={handleRetry}
                    className="mt-1 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs active:scale-95 transition"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && !(mode === 'aws_live' && !hasLiveData) && (
            <ErrorBoundary label="The dashboard" resetKeys={[selectedZone, mode, lastUpdated]}>
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
              outdoorPm25={outdoorPm25}
              unavailableMetrics={unavailableMetrics}
              mode={mode}
              selectedZone={selectedZone}
              isApiLoading={isApiLoading}
              isStale={isStale}
              hasLiveData={hasLiveData}
              apiError={apiError}
              apiErrorKind={apiErrorKind}
              lastUpdated={lastUpdated}
              onRetry={handleRetry}
              isLiveStreaming={isLiveStreaming}
              setIsLiveStreaming={setIsLiveStreaming}
              onReset={handleReset}
              onOpenHepa={() => setActiveTab('hepa')}
              isDarkMode={isDarkMode}
            />
            </ErrorBoundary>
          )}

          {activeTab === 'hepa' && (
            <ErrorBoundary label="The HEPA chamber">
              <HepaChamber />
            </ErrorBoundary>
          )}

          {activeTab === 'earthmap' && (
            <ErrorBoundary label="The global AQI map">
            <GlobalAqiMap
              onSyncTelemetry={handleSyncTelemetryFromMap}
              isAlarmMuted={isAlarmMuted}
              setIsAlarmMuted={setIsAlarmMuted}
              isAlarmActive={isAlarmActive}
              onStopAlarm={handleStopAlarm}
              onReenableAlarm={handleReenableAlarm}
            />
            </ErrorBoundary>
          )}
        </main>

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
            {mode === 'aws_live' && telemetrySource && (
              <span
                className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                title="The `source` field on the BuildingTelemetry record now being displayed"
              >
                record source: {telemetrySource}
                {typeof occupancy === 'number' ? ` • occupancy ${occupancy}` : ''}
                {telemetryTimestampMs ? ` • ${new Date(telemetryTimestampMs).toLocaleString()}` : ''}
              </span>
            )}
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
