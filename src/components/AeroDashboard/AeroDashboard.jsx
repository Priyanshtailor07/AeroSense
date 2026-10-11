import React, { useState, useEffect, useRef } from 'react';
import { Wind, Flame, Activity, Zap, ShieldCheck, DollarSign, Server, Radio, AlertTriangle } from 'lucide-react';
import AmbientAlertBar from './AmbientAlertBar';
import MetricCard from './MetricCard';
import HvacDigitalTwin3D from './HvacDigitalTwin3D';
import HvacControlSidebar from './HvacControlSidebar';
import TelemetryAuditCard from './TelemetryAuditCard';
import BenchmarkComparison from './BenchmarkComparison';
import ScientificOverview from './ScientificOverview';
import { formatNumber, isFiniteNumber, below } from '../../utils/formatNumber';
import ErrorBoundary from '../ErrorBoundary';

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
  // AWS Live props default to null, not to plausible numbers: the
  // BuildingTelemetry API does not publish fan speed, filter health, pressure
  // drop or cumulative energy/cost, and those must read as "n/a".
  damperPct: propsDamperPct = null,
  setDamperPct: setPropsDamperPct,
  recommendedDamperPct = null,
  fanSpeedPct: propsFanSpeedPct = null,
  setFanSpeedPct: setPropsFanSpeedPct,
  fanPowerKw: propsFanPowerKw = null,
  filterHealthPct: propsFilterHealthPct = null,
  currentDpPa: propsCurrentDpPa = null,
  cumulativeEnergyKwh: propsCumulativeEnergyKwh = null,
  cumulativeCostUsd: propsCumulativeCostUsd = null,
  rationale: propsRationale = '',
  outdoorPm25: awsOutdoorPm25 = null,
  unavailableMetrics = [],
  recommendationOnly = true,
  sparklines = {},
  liveAlerts = [],
  mode = 'simulation',
  // No fabricated label: the API returns ids such as "zone-01" and no names.
  selectedZone = null,
  isApiLoading = false,
  isStale = false,
  lastUpdated = null,
  onRetry,
  isLiveStreaming,
  setIsLiveStreaming,
  onReset,
  onOpenHepa,
  isDarkMode = false,
}) {
  // Physical Simulation Parameters (Active ONLY in Local Simulation Mode)
  const [roomPreset, setRoomPreset] = useState('office');
  const [roomVolM3, setRoomVolM3] = useState(500.0);
  const [ceilingHeightM, setCeilingHeightM] = useState(3.5);
  const [targetCO2Max, setTargetCO2Max] = useState(850.0);
  const [infiltrationAch, setInfiltrationAch] = useState(0.12);

  const [airScenario, setAirScenario] = useState('clean');
  const [ambientPM25, setAmbientPM25] = useState(25.0);
  const [ambientCO2, setAmbientCO2] = useState(415.0);

  const [controlMode, setControlMode] = useState('ai');
  const [manualDamper, setManualDamper] = useState(20.0);
  const [manualFan, setManualFan] = useState(50.0);

  const [occupancy, setOccupancy] = useState(28);
  const [isPeakTariff, setIsPeakTariff] = useState(false);
  const [filterState, setFilterState] = useState('clean');

  // Local Physical Simulation State (used when mode === 'simulation')
  const [localDamperPct, setLocalDamperPct] = useState(20.0);
  const [localFanSpeedPct, setLocalFanSpeedPct] = useState(28.0);
  const [accumulatedDustG, setAccumulatedDustG] = useState(22.0);
  const [localFilterHealthPct, setLocalFilterHealthPct] = useState(97.2);
  const [localCurrentDpPa, setLocalCurrentDpPa] = useState(130.0);
  const [localFanPowerKw, setLocalFanPowerKw] = useState(0.85);
  const [localCumulativeEnergyKwh, setLocalCumulativeEnergyKwh] = useState(0.08);
  const [localCumulativeCostUsd, setLocalCumulativeCostUsd] = useState(0.04);
  const [localRationale, setLocalRationale] = useState(
    'Local Simulation initialized: Closed-loop multi-variable optimizer active.'
  );

  // Sparkline Histories for Local Simulation
  const [localPm25History, setLocalPm25History] = useState([8.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5]);
  const [localCo2History, setLocalCo2History] = useState([640, 645, 652, 648, 655, 650, 650]);
  const [localPowerHistory, setLocalPowerHistory] = useState([0.82, 0.84, 0.85, 0.83, 0.86, 0.85, 0.85]);
  const [localFilterHistory, setLocalFilterHistory] = useState([98.0, 97.8, 97.6, 97.5, 97.4, 97.3, 97.2]);

  // Physical Constants
  const MAX_AIRFLOW_M3H = 3600.0;
  const BASE_FAN_POWER_KW = 2.4;
  const HEPA_EFFICIENCY = 0.9997;
  const MAX_DUST_CAPACITY_G = 800.0;
  const CLEAN_DP_PA = 120.0;
  const FILTER_REPLACE_COST_USD = 650.0;

  // Sync Scenario changes with realistic initial surges in simulation mode
  useEffect(() => {
    if (mode === 'aws_live') return;
    if (airScenario === 'extreme') {
      setAmbientPM25(495.0);
      setAqi(500);
      setPm25(38.5);
    } else if (airScenario === 'disturbed') {
      setAmbientPM25(390.0);
      setAqi(420);
      setPm25(26.0);
    } else if (airScenario === 'slight') {
      setAmbientPM25(140.0);
      setAqi(190);
      setPm25(14.5);
    } else if (airScenario === 'clean') {
      setAmbientPM25(25.0);
      setAqi(45);
      setPm25(7.5);
    }
  }, [airScenario, mode, setAqi, setPm25]);

  // Sync Filter State presets in simulation mode
  useEffect(() => {
    if (mode === 'aws_live') return;
    if (filterState === 'clean') {
      setAccumulatedDustG(0.0);
      setLocalFilterHealthPct(100.0);
      setLocalCurrentDpPa(CLEAN_DP_PA);
    } else if (filterState === 'seasoned') {
      setAccumulatedDustG(280.0);
      setLocalFilterHealthPct(65.0);
      setLocalCurrentDpPa(195.0);
    } else if (filterState === 'clogged') {
      setAccumulatedDustG(620.0);
      setLocalFilterHealthPct(22.5);
      setLocalCurrentDpPa(340.0);
    }
  }, [filterState, mode]);

  // Ref container for latest state inside local simulation interval
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      roomVolM3,
      ceilingHeightM,
      targetCO2Max,
      infiltrationAch,
      occupancy,
      ambientPM25,
      ambientCO2,
      indoorPM25: pm25,
      indoorCO2: co2,
      controlMode,
      manualDamper,
      manualFan,
      damperPct: localDamperPct,
      fanSpeedPct: localFanSpeedPct,
      accumulatedDustG,
      filterHealthPct: localFilterHealthPct,
      currentDpPa: localCurrentDpPa,
      fanPowerKw: localFanPowerKw,
      cumulativeEnergyKwh: localCumulativeEnergyKwh,
      cumulativeCostUsd: localCumulativeCostUsd,
      isPeakTariff,
    };
  }, [
    roomVolM3,
    ceilingHeightM,
    targetCO2Max,
    infiltrationAch,
    occupancy,
    ambientPM25,
    ambientCO2,
    pm25,
    co2,
    controlMode,
    manualDamper,
    manualFan,
    localDamperPct,
    localFanSpeedPct,
    accumulatedDustG,
    localFilterHealthPct,
    localCurrentDpPa,
    localFanPowerKw,
    localCumulativeEnergyKwh,
    localCumulativeCostUsd,
    isPeakTariff,
  ]);

  // 1 Tick / Sec Physics Loop - RUNS ONLY IN LOCAL SIMULATION MODE
  useEffect(() => {
    if (mode === 'aws_live') return; // DO NOT OVERWRITE AWS LIVE TELEMETRY

    const interval = setInterval(() => {
      const s = stateRef.current;
      const dtHr = 1.0 / 3600.0;

      // 1. Controller Logic
      let nextDamper = s.damperPct;
      let nextFan = s.fanSpeedPct;
      let currentRationale = '';

      if (s.controlMode === 'manual') {
        nextDamper = s.manualDamper;
        nextFan = s.manualFan;
        currentRationale = `Manual Operator Radio Override: Damper held at ${nextDamper}%, Fan speed held at ${nextFan}%. Autonomous optimizer offline.`;
      } else if (s.controlMode === 'bms') {
        if (s.indoorCO2 > s.targetCO2Max) {
          nextDamper = 75.0;
          nextFan = 85.0;
          currentRationale = `Static BMS Rule: CO₂ target crossed (>${s.targetCO2Max} ppm). Forcing 75% fresh outdoor damper intake.`;
        } else if (s.indoorPM25 > 25.0) {
          nextDamper = 20.0;
          nextFan = 100.0;
          currentRationale = 'Static BMS Rule: PM₂.₅ above 25 µg/m³. Operating fan at maximum 100% capacity.';
        } else {
          nextDamper = 35.0;
          nextFan = 60.0;
          currentRationale = 'Static BMS Rule: Baseline static schedule active (Damper 35%, Fan 60%).';
        }
      } else {
        // Autonomous AI Agent
        let targetDamper = 20.0;
        let targetFan = 28.0;
        let reasonVent = '';
        let reasonFan = '';

        if (s.ambientPM25 > 280.0) {
          if (s.indoorCO2 > s.targetCO2Max + 30.0) {
            targetDamper = 12.0;
            reasonVent = `Severe outdoor smog (${s.ambientPM25.toFixed(0)} µg/m³): Micro-pulsing fresh damper to 12% to cap CO₂.`;
          } else {
            targetDamper = 3.0;
            reasonVent = `Severe outdoor smog (${s.ambientPM25.toFixed(0)} µg/m³): Protective shield active. Throttled damper to 3%.`;
          }
        } else if (s.ambientPM25 > 90.0) {
          targetDamper = s.indoorCO2 > s.targetCO2Max - 50.0 ? 22.0 : 12.0;
          reasonVent = `Moderate outdoor particulate (${s.ambientPM25.toFixed(0)} µg/m³): Regulating fresh damper at ${targetDamper}%.`;
        } else {
          targetDamper = s.indoorCO2 > s.targetCO2Max - 100.0 ? 45.0 : 25.0;
          reasonVent = `Clean outdoor air: Natural fresh ventilation flush (${targetDamper}% damper).`;
        }

        if (s.ambientPM25 > 280.0 || s.indoorPM25 > 18.0) {
          targetFan = s.isPeakTariff ? 74.0 : 84.0;
          reasonFan = `High PM: POWER SCRUBBING MODE (${targetFan.toFixed(0)}%) engaged.`;
        } else if (s.ambientPM25 > 90.0 || s.indoorPM25 > 12.0) {
          targetFan = s.isPeakTariff ? 48.0 : 58.0;
          reasonFan = `Moderate particulate: Fan in BALANCED PURIFICATION (${targetFan.toFixed(0)}%).`;
        } else if (s.indoorPM25 > 6.0) {
          targetFan = s.isPeakTariff ? 26.0 : 32.0;
          reasonFan = `Air clean: Low-strain recirculation at ${targetFan.toFixed(0)}%.`;
        } else {
          targetFan = 25.0;
          reasonFan = `Air pristine: Whisper eco-flow at ${targetFan.toFixed(0)}%.`;
        }

        nextDamper = s.damperPct + (targetDamper - s.damperPct) * 0.25;
        nextFan = s.fanSpeedPct + (targetFan - s.fanSpeedPct) * 0.25;
        currentRationale = `${reasonVent} ${reasonFan}`;
      }

      // Physics Equations
      const damperFrac = Math.max(0, Math.min(1, nextDamper / 100.0));
      const fanFrac = Math.max(0, Math.min(1, nextFan / 100.0));

      const totalAirflowM3h = MAX_AIRFLOW_M3H * fanFrac;
      const qFreshM3h = totalAirflowM3h * damperFrac + s.roomVolM3 * s.infiltrationAch;
      const qRecircM3h = totalAirflowM3h * (1.0 - damperFrac);

      const co2GenM3h = s.occupancy * 0.0187;
      const deltaCO2 =
        ((co2GenM3h * 1e6 + qFreshM3h * s.ambientCO2 - qFreshM3h * s.indoorCO2) / s.roomVolM3) * dtHr;
      const updatedIndoorCO2 = Math.max(s.ambientCO2, s.indoorCO2 + deltaCO2);

      const pmInletMix =
        totalAirflowM3h > 0
          ? (qFreshM3h * s.ambientPM25 + qRecircM3h * s.indoorPM25) / totalAirflowM3h
          : s.ambientPM25;
      const pmCapturedUgH = totalAirflowM3h * pmInletMix * HEPA_EFFICIENCY;
      const pmEnteringRoomUgH = totalAirflowM3h * pmInletMix * (1.0 - HEPA_EFFICIENCY);

      const depositionM3h = s.roomVolM3 * 0.15;
      const deltaPM =
        ((pmEnteringRoomUgH - (totalAirflowM3h + depositionM3h) * s.indoorPM25) / s.roomVolM3) * dtHr;
      const leakPM =
        ((s.roomVolM3 * s.infiltrationAch * (s.ambientPM25 - s.indoorPM25)) / s.roomVolM3) * dtHr;
      const updatedIndoorPM = Math.max(1.0, s.indoorPM25 + deltaPM + leakPM);

      const dustCapturedG = pmCapturedUgH * dtHr * 1e-6;
      const updatedAccumulatedDust = s.accumulatedDustG + dustCapturedG * 18.0;
      const loadingRatio = Math.min(1.0, updatedAccumulatedDust / MAX_DUST_CAPACITY_G);
      const updatedFilterHealth = Math.max(0.0, (1.0 - loadingRatio) * 100.0);
      const updatedDp = CLEAN_DP_PA * fanFrac * (1.0 + 2.8 * Math.pow(loadingRatio, 1.8));

      const dpRatio = Math.max(1.0, updatedDp / Math.max(1.0, CLEAN_DP_PA * Math.max(0.1, fanFrac)));
      const updatedPowerKw = BASE_FAN_POWER_KW * Math.pow(fanFrac, 3.0) * (0.7 + 0.3 * dpRatio);

      const tariffRate = s.isPeakTariff ? 0.28 : 0.12;
      const energyKwh = updatedPowerKw * dtHr;
      const wearCostUsd = ((dustCapturedG * 18.0) / MAX_DUST_CAPACITY_G) * FILTER_REPLACE_COST_USD;

      const updatedEnergy = s.cumulativeEnergyKwh + energyKwh;
      const updatedCost = s.cumulativeCostUsd + energyKwh * tariffRate + wearCostUsd;

      setLocalDamperPct(nextDamper);
      setLocalFanSpeedPct(nextFan);
      setLocalRationale(currentRationale);

      setPm25(Number(updatedIndoorPM.toFixed(1)));
      setCo2(Math.round(updatedIndoorCO2));
      setAccumulatedDustG(updatedAccumulatedDust);
      setLocalFilterHealthPct(Number(updatedFilterHealth.toFixed(1)));
      setLocalCurrentDpPa(Number(updatedDp.toFixed(0)));
      setLocalFanPowerKw(Number(updatedPowerKw.toFixed(2)));
      setLocalCumulativeEnergyKwh(updatedEnergy);
      setLocalCumulativeCostUsd(updatedCost);

      setLocalPm25History((prev) => [...prev.slice(1), Number(updatedIndoorPM.toFixed(1))]);
      setLocalCo2History((prev) => [...prev.slice(1), Math.round(updatedIndoorCO2)]);
      setLocalPowerHistory((prev) => [...prev.slice(1), Number(updatedPowerKw.toFixed(2))]);
      setLocalFilterHistory((prev) => [...prev.slice(1), Number(updatedFilterHealth.toFixed(1))]);
    }, 1000);

    return () => clearInterval(interval);
  }, [mode, setPm25, setCo2]);

  // Determine active display values based on mode
  const activeDamperPct = mode === 'aws_live' ? propsDamperPct : localDamperPct;
  const activeFanSpeedPct = mode === 'aws_live' ? propsFanSpeedPct : localFanSpeedPct;
  const activeFanPowerKw = mode === 'aws_live' ? propsFanPowerKw : localFanPowerKw;
  const activeFilterHealthPct = mode === 'aws_live' ? propsFilterHealthPct : localFilterHealthPct;
  const activeCurrentDpPa = mode === 'aws_live' ? propsCurrentDpPa : localCurrentDpPa;
  const activeCumulativeEnergyKwh = mode === 'aws_live' ? propsCumulativeEnergyKwh : localCumulativeEnergyKwh;
  const activeCumulativeCostUsd = mode === 'aws_live' ? propsCumulativeCostUsd : localCumulativeCostUsd;
  const activeRationale =
    mode === 'aws_live'
      ? propsRationale || 'The optimizer returned no rationale for this record.'
      : localRationale;

  /**
   * Real outdoor PM2.5 from the API when running live; the simulation's own
   * ambient figure otherwise.
   */
  const activeAmbientPM25 =
    mode === 'aws_live' && awsOutdoorPm25 !== null ? awsOutdoorPm25 : ambientPM25;

  /** Format a possibly-absent reading for display. */
  const fmt = (value, digits = 1, suffix = '') => formatNumber(value, { digits, suffix });

  const pm25Hist = mode === 'aws_live' ? (sparklines.pm25History || localPm25History) : localPm25History;
  const co2Hist = mode === 'aws_live' ? (sparklines.co2History || localCo2History) : localCo2History;
  const powerHist = mode === 'aws_live' ? (sparklines.powerHistory || localPowerHistory) : localPowerHistory;
  const filterHist = mode === 'aws_live' ? (sparklines.filterHistory || localFilterHistory) : localFilterHistory;

  // Status Badges
  const getPmBadge = (val) => {
    if (val <= 12)
      return {
        label: 'WHO Safe (≤12)',
        color:
          'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
      };
    if (val <= 25)
      return {
        label: 'Moderate (12-25)',
        color:
          'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
      };
    return {
      label: 'Hazard (>25)',
      color:
        'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800',
    };
  };

  const getCo2Badge = (val, maxTarget) => {
    if (val <= maxTarget)
      return {
        label: 'Optimal (<900)',
        color:
          'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
      };
    return {
      label: 'Stuffy (>Target)',
      color:
        'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    };
  };

  const pmBadgeInfo = getPmBadge(pm25);
  const co2BadgeInfo = getCo2Badge(co2, targetCO2Max);

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Ambient Status Alert Bar */}
      <AmbientAlertBar
        theme={theme}
        aqi={aqi}
        humidity={humidity}
        pm25={pm25}
        onOpenHepa={onOpenHepa}
        mode={mode}
        selectedZone={selectedZone}
        isApiLoading={isApiLoading}
        isStale={isStale}
        lastUpdated={lastUpdated}
        liveAlerts={liveAlerts}
      />

      {/* Mode Operational Notice Bar */}
      {mode === 'aws_live' && (
        <div className="glass-panel p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <span className="font-extrabold uppercase tracking-wide">AWS Live Telemetry Engine: </span>
              <span className="font-mono">Zone: {selectedZone}</span> • Live stream from DynamoDB BuildingTelemetry table.
            </div>
          </div>
          {recommendationOnly && (
            <div className="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 text-[10px] font-mono font-extrabold tracking-wider uppercase shrink-0">
              RECOMMENDATION ONLY (No Physical Actuation)
            </div>
          )}
        </div>
      )}

      {/* 2. Main Dashboard Layout (Grid with Left Control Sidebar & Right Digital Twin/Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Controls */}
        <div className="lg:col-span-4">
          <HvacControlSidebar
            roomPreset={roomPreset}
            setRoomPreset={setRoomPreset}
            roomVolM3={roomVolM3}
            setRoomVolM3={setRoomVolM3}
            ceilingHeightM={ceilingHeightM}
            setCeilingHeightM={setCeilingHeightM}
            targetCO2Max={targetCO2Max}
            setTargetCO2Max={setTargetCO2Max}
            infiltrationAch={infiltrationAch}
            setInfiltrationAch={setInfiltrationAch}
            airScenario={airScenario}
            setAirScenario={setAirScenario}
            controlMode={controlMode}
            setControlMode={setControlMode}
            manualDamper={manualDamper}
            setManualDamper={setManualDamper}
            manualFan={manualFan}
            setManualFan={setManualFan}
            occupancy={occupancy}
            setOccupancy={setOccupancy}
            isPeakTariff={isPeakTariff}
            setIsPeakTariff={setIsPeakTariff}
            filterState={filterState}
            setFilterState={setFilterState}
            mode={mode}
          />
        </div>

        {/* Right Column: 3D Digital Twin, 4 Metrics, Telemetry & Benchmark */}
        <div className="lg:col-span-8 space-y-6">
          {/* 3D WebGL Industrial HVAC & Dynamic Room Digital Twin */}
          <ErrorBoundary label="The 3D digital twin" resetKeys={[selectedZone, mode]}>
          <HvacDigitalTwin3D
            damperPct={activeDamperPct}
            fanSpeedPct={activeFanSpeedPct}
            filterHealthPct={activeFilterHealthPct}
            roomVolM3={roomVolM3}
            ceilingHeightM={ceilingHeightM}
            occupancy={occupancy}
            ambientPM25={activeAmbientPM25}
            indoorPM25={pm25}
            indoorCO2={co2}
            targetCO2Max={targetCO2Max}
            theme={theme}
          />
          </ErrorBoundary>

          {/* 4 Key Real-Time Metrics Grid */}
          <ErrorBoundary label="The metrics grid" resetKeys={[selectedZone, pm25, co2]}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Metric 1: Indoor PM2.5 */}
            <MetricCard
              title="Indoor PM2.5 Particulate"
              value={pm25}
              unit="µg/m³"
              latexUnit="µg/m³"
              icon={Flame}
              badge={pmBadgeInfo.label}
              badgeColor={pmBadgeInfo.color}
              min={0}
              max={100}
              history={pm25Hist}
              accentColor="#ef4444"
              description="WHO Safety Ceiling: < 15.0 µg/m³"
              isLive={mode === 'aws_live'}
            />

            {/* Metric 2: Indoor CO2 */}
            <MetricCard
              title="Indoor Carbon Dioxide"
              value={co2}
              unit="ppm"
              latexUnit="ppm"
              icon={Activity}
              badge={co2BadgeInfo.label}
              badgeColor={co2BadgeInfo.color}
              min={400}
              max={1500}
              history={co2Hist}
              accentColor="#10b981"
              description={`Health Target: < ${targetCO2Max} ppm`}
              isLive={mode === 'aws_live'}
            />

            {/* Metric 3: HVAC Fan Power */}
            <MetricCard
              title="HVAC Fan Power Draw"
              value={activeFanPowerKw}
              unit="kW"
              latexUnit="kW"
              icon={Zap}
              badge={isPeakTariff ? 'Surge ($0.28)' : 'Off-Peak ($0.12)'}
              badgeColor={
                isPeakTariff
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }
              min={0.1}
              max={3.0}
              history={powerHist}
              accentColor="#6366f1"
              description="Fan Affinity Law: P ∝ RPM³"
              isEstimated={mode === 'aws_live'}
            />

            {/* Metric 4: HEPA Filter Health */}
            <MetricCard
              title="HEPA Filter Health & ΔP"
              value={activeFilterHealthPct}
              unit="%"
              latexUnit="%"
              icon={ShieldCheck}
              badge={`ΔP: ${formatNumber(activeCurrentDpPa, { digits: 0, suffix: ' Pa' })}`}
              badgeColor={
                below(activeFilterHealthPct, 30)
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              }
              min={0}
              max={100}
              history={filterHist}
              accentColor="#059669"
              description={
                mode === 'aws_live' && !isFiniteNumber(activeFilterHealthPct)
                  ? 'Not published by the API'
                  : `Dust Cake: ${formatNumber(accumulatedDustG, { digits: 1 })} g (Estimated)`
              }
              isEstimated={mode === 'aws_live'}
            />
          </div>
          </ErrorBoundary>

          {/* Machine Telemetry & Closed-Loop Actuation Audit */}
          <ErrorBoundary label="The telemetry audit panel" resetKeys={[selectedZone, activeDamperPct]}>
          <TelemetryAuditCard
            damperPct={activeDamperPct}
            recommendedDamperPct={recommendedDamperPct}
            fanSpeedPct={activeFanSpeedPct}
            cumulativeCostUsd={activeCumulativeCostUsd}
            cumulativeEnergyKwh={activeCumulativeEnergyKwh}
            rationale={activeRationale}
            controlMode={controlMode}
            mode={mode}
            recommendationOnly={recommendationOnly}
            selectedZone={selectedZone}
          />
          </ErrorBoundary>

          {/* Parallel Benchmark Comparison Card */}
          <ErrorBoundary label="The benchmark comparison" compact resetKeys={[activeFanPowerKw]}>
            <BenchmarkComparison aiPowerKw={activeFanPowerKw} />
          </ErrorBoundary>
        </div>
      </div>

      {/* 3. Scientific & Mathematical Standards Matrix */}
      <ScientificOverview />
    </div>
  );
}
