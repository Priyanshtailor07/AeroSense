import React, { useState, useEffect, useRef } from 'react';
import { Wind, Flame, Activity, Zap, ShieldCheck, DollarSign } from 'lucide-react';
import AmbientAlertBar from './AmbientAlertBar';
import MetricCard from './MetricCard';
import HvacDigitalTwin3D from './HvacDigitalTwin3D';
import HvacControlSidebar from './HvacControlSidebar';
import TelemetryAuditCard from './TelemetryAuditCard';
import BenchmarkComparison from './BenchmarkComparison';
import ScientificOverview from './ScientificOverview';

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
  isDarkMode = false,
}) {
  // Physical Simulation Parameters (from Manan)
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

  // Dynamic Physical State
  const [damperPct, setDamperPct] = useState(20.0);
  const [fanSpeedPct, setFanSpeedPct] = useState(28.0);
  const [accumulatedDustG, setAccumulatedDustG] = useState(22.0);
  const [filterHealthPct, setFilterHealthPct] = useState(97.2);
  const [currentDpPa, setCurrentDpPa] = useState(130.0);
  const [fanPowerKw, setFanPowerKw] = useState(0.85);
  const [cumulativeEnergyKwh, setCumulativeEnergyKwh] = useState(0.08);
  const [cumulativeCostUsd, setCumulativeCostUsd] = useState(0.04);
  const [rationale, setRationale] = useState(
    'Telemetry initialized: Closed-loop multi-variable optimizer balancing indoor particulate, CO₂ accumulation, and fan energy.'
  );

  // Sparkline Histories
  const [pm25History, setPm25History] = useState([8.2, 8.4, 8.5, 8.3, 8.6, 8.4, 8.5]);
  const [co2History, setCo2History] = useState([640, 645, 652, 648, 655, 650, 650]);
  const [powerHistory, setPowerHistory] = useState([0.82, 0.84, 0.85, 0.83, 0.86, 0.85, 0.85]);
  const [filterHistory, setFilterHistory] = useState([98.0, 97.8, 97.6, 97.5, 97.4, 97.3, 97.2]);

  // Physical Constants
  const MAX_AIRFLOW_M3H = 3600.0;
  const BASE_FAN_POWER_KW = 2.4;
  const HEPA_EFFICIENCY = 0.9997;
  const MAX_DUST_CAPACITY_G = 800.0;
  const CLEAN_DP_PA = 120.0;
  const FILTER_REPLACE_COST_USD = 650.0;

  // Sync Scenario changes with realistic initial surges
  useEffect(() => {
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
  }, [airScenario]);

  // Sync Filter State presets
  useEffect(() => {
    if (filterState === 'clean') {
      setAccumulatedDustG(0.0);
      setFilterHealthPct(100.0);
      setCurrentDpPa(CLEAN_DP_PA);
    } else if (filterState === 'seasoned') {
      setAccumulatedDustG(280.0);
      setFilterHealthPct(65.0);
      setCurrentDpPa(195.0);
    } else if (filterState === 'clogged') {
      setAccumulatedDustG(620.0);
      setFilterHealthPct(22.5);
      setCurrentDpPa(340.0);
    }
  }, [filterState]);

  // Ref container for latest state inside simulation interval
  const stateRef = useRef({
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
    damperPct,
    fanSpeedPct,
    accumulatedDustG,
    filterHealthPct,
    currentDpPa,
    fanPowerKw,
    cumulativeEnergyKwh,
    cumulativeCostUsd,
    isPeakTariff,
  });

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
      damperPct,
      fanSpeedPct,
      accumulatedDustG,
      filterHealthPct,
      currentDpPa,
      fanPowerKw,
      cumulativeEnergyKwh,
      cumulativeCostUsd,
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
    damperPct,
    fanSpeedPct,
    accumulatedDustG,
    filterHealthPct,
    currentDpPa,
    fanPowerKw,
    cumulativeEnergyKwh,
    cumulativeCostUsd,
    isPeakTariff,
  ]);

  // Real-Time Physics & Closed-Loop Controller Loop (1 tick / sec)
  useEffect(() => {
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
          currentRationale = `Static BMS Rule: CO₂ target crossed (>${s.targetCO2Max} ppm). Forcing 75% fresh outdoor damper intake irrespective of outdoor smog level.`;
        } else if (s.indoorPM25 > 25.0) {
          nextDamper = 20.0;
          nextFan = 100.0;
          currentRationale =
            'Static BMS Rule: PM₂.₅ above 25 µg/m³. Operating fan at maximum 100% capacity (exponential cubic power draw).';
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
            reasonVent = `Severe outdoor smog (${s.ambientPM25.toFixed(0)} µg/m³): Micro-pulsing fresh damper to 12% to cap CO₂ under ${s.targetCO2Max} ppm in ${s.roomVolM3}m³ space.`;
          } else {
            targetDamper = 3.0;
            reasonVent = `Severe outdoor smog (${s.ambientPM25.toFixed(0)} µg/m³): Protective shield active. Throttled damper to 3% to block particulate ingress into room.`;
          }
        } else if (s.ambientPM25 > 90.0) {
          if (s.indoorCO2 > s.targetCO2Max - 50.0) {
            targetDamper = 22.0;
          } else {
            targetDamper = 12.0;
          }
          reasonVent = `Moderate outdoor particulate (${s.ambientPM25.toFixed(0)} µg/m³): Regulating fresh damper at ${targetDamper}%.`;
        } else {
          if (s.indoorCO2 > s.targetCO2Max - 100.0) {
            targetDamper = 45.0;
          } else {
            targetDamper = 25.0;
          }
          reasonVent = `Clean outdoor air: Free natural fresh ventilation flush (${targetDamper}% damper).`;
        }

        if (s.ambientPM25 > 280.0 || s.indoorPM25 > 18.0) {
          targetFan = s.isPeakTariff ? 74.0 : 84.0;
          if (s.ambientPM25 > 280.0) {
            reasonFan = `Catastrophic Smog Alert: Engaged POWER SCRUBBING MODE (${targetFan.toFixed(0)}%) to aggressively scrub infiltration leaks.`;
          } else {
            reasonFan = `Indoor PM elevated (${s.indoorPM25.toFixed(1)} µg/m³): POWER MODE (${targetFan.toFixed(0)}%) activated to restore safe limit.`;
          }
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

        if (s.isPeakTariff && s.indoorPM25 < 15.0 && s.ambientPM25 <= 280.0) {
          reasonFan += ' [Grid Peak Tariff: Throttled to cut operating cost]';
        }

        // Smooth transition
        nextDamper = s.damperPct + (targetDamper - s.damperPct) * 0.25;
        nextFan = s.fanSpeedPct + (targetFan - s.fanSpeedPct) * 0.25;
        currentRationale = `${reasonVent} ${reasonFan}`;
      }

      // 2. Physics Equations
      const damperFrac = Math.max(0, Math.min(1, nextDamper / 100.0));
      const fanFrac = Math.max(0, Math.min(1, nextFan / 100.0));

      const totalAirflowM3h = MAX_AIRFLOW_M3H * fanFrac;
      const qFreshM3h = totalAirflowM3h * damperFrac + s.roomVolM3 * s.infiltrationAch;
      const qRecircM3h = totalAirflowM3h * (1.0 - damperFrac);

      // CO2 Balance
      const co2GenM3h = s.occupancy * 0.0187;
      const co2GenPpmM3h = co2GenM3h * 1e6;
      const deltaCO2 =
        ((co2GenPpmM3h + qFreshM3h * s.ambientCO2 - qFreshM3h * s.indoorCO2) / s.roomVolM3) * dtHr;
      const updatedIndoorCO2 = Math.max(s.ambientCO2, s.indoorCO2 + deltaCO2);

      // PM2.5 Balance
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

      // Filter Loading & DP
      const dustCapturedG = pmCapturedUgH * dtHr * 1e-6;
      const updatedAccumulatedDust = s.accumulatedDustG + dustCapturedG * 18.0;
      const loadingRatio = Math.min(1.0, updatedAccumulatedDust / MAX_DUST_CAPACITY_G);
      const updatedFilterHealth = Math.max(0.0, (1.0 - loadingRatio) * 100.0);

      const updatedDp = CLEAN_DP_PA * fanFrac * (1.0 + 2.8 * Math.pow(loadingRatio, 1.8));

      // Power & Economics
      const dpRatio = Math.max(1.0, updatedDp / Math.max(1.0, CLEAN_DP_PA * Math.max(0.1, fanFrac)));
      const updatedPowerKw = BASE_FAN_POWER_KW * Math.pow(fanFrac, 3.0) * (0.7 + 0.3 * dpRatio);

      const tariffRate = s.isPeakTariff ? 0.28 : 0.12;
      const energyKwh = updatedPowerKw * dtHr;
      const wearCostUsd = ((dustCapturedG * 18.0) / MAX_DUST_CAPACITY_G) * FILTER_REPLACE_COST_USD;

      const updatedEnergy = s.cumulativeEnergyKwh + energyKwh;
      const updatedCost = s.cumulativeCostUsd + energyKwh * tariffRate + wearCostUsd;

      // Update States
      setDamperPct(nextDamper);
      setFanSpeedPct(nextFan);
      setRationale(currentRationale);

      setPm25(Number(updatedIndoorPM.toFixed(1)));
      setCo2(Math.round(updatedIndoorCO2));
      setAccumulatedDustG(updatedAccumulatedDust);
      setFilterHealthPct(Number(updatedFilterHealth.toFixed(1)));
      setCurrentDpPa(Number(updatedDp.toFixed(0)));
      setFanPowerKw(Number(updatedPowerKw.toFixed(2)));
      setCumulativeEnergyKwh(updatedEnergy);
      setCumulativeCostUsd(updatedCost);

      // History sparklines
      setPm25History((prev) => [...prev.slice(1), Number(updatedIndoorPM.toFixed(1))]);
      setCo2History((prev) => [...prev.slice(1), Math.round(updatedIndoorCO2)]);
      setPowerHistory((prev) => [...prev.slice(1), Number(updatedPowerKw.toFixed(2))]);
      setFilterHistory((prev) => [...prev.slice(1), Number(updatedFilterHealth.toFixed(1))]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Status Badges computation
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
      />

      {/* 2. Main Dashboard Layout (Grid with Left Control Sidebar & Right Digital Twin/Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: All Interactive Controls (4 cols on lg) */}
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
          />
        </div>

        {/* Right Column: 3D Digital Twin, 4 Metrics, Telemetry & Benchmark (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {/* 3D WebGL Industrial HVAC & Dynamic Room Digital Twin */}
          <HvacDigitalTwin3D
            damperPct={damperPct}
            fanSpeedPct={fanSpeedPct}
            filterHealthPct={filterHealthPct}
            roomVolM3={roomVolM3}
            ceilingHeightM={ceilingHeightM}
            occupancy={occupancy}
            ambientPM25={ambientPM25}
            indoorPM25={pm25}
            indoorCO2={co2}
            targetCO2Max={targetCO2Max}
            theme={theme}
          />

          {/* 4 Key Real-Time Metrics Grid */}
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
              history={pm25History}
              accentColor="#ef4444"
              description="WHO Safety Ceiling: < 15.0 µg/m³"
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
              history={co2History}
              accentColor="#10b981"
              description={`Health Target: < ${targetCO2Max} ppm`}
            />

            {/* Metric 3: HVAC Fan Power */}
            <MetricCard
              title="HVAC Fan Power Draw"
              value={fanPowerKw}
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
              history={powerHistory}
              accentColor="#6366f1"
              description="Fan Affinity Law: P ∝ RPM³"
            />

            {/* Metric 4: HEPA Filter Health */}
            <MetricCard
              title="HEPA Filter Health & ΔP"
              value={filterHealthPct}
              unit="%"
              latexUnit="%"
              icon={ShieldCheck}
              badge={`ΔP: ${currentDpPa} Pa`}
              badgeColor={
                filterHealthPct < 30
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              }
              min={0}
              max={100}
              history={filterHistory}
              accentColor="#059669"
              description={`Dust Cake: ${accumulatedDustG.toFixed(1)} g`}
            />
          </div>

          {/* Machine Telemetry & Closed-Loop Actuation Audit */}
          <TelemetryAuditCard
            damperPct={damperPct}
            fanSpeedPct={fanSpeedPct}
            cumulativeCostUsd={cumulativeCostUsd}
            cumulativeEnergyKwh={cumulativeEnergyKwh}
            rationale={rationale}
            controlMode={controlMode}
          />

          {/* Parallel Benchmark Comparison Card */}
          <BenchmarkComparison aiPowerKw={fanPowerKw} />
        </div>
      </div>

      {/* 3. Scientific & Mathematical Standards Matrix */}
      <ScientificOverview />
    </div>
  );
}
