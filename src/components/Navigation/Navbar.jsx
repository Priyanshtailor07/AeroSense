import React from 'react';
import { Wind, Shield, Globe, Sun, Moon, Server, Radio, KeyRound, RefreshCw, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  aqi,
  humidity,
  isDarkMode = false,
  setIsDarkMode,
  mode = 'simulation',
  setMode,
  zones = [],
  selectedZone = 'Zone-1',
  setSelectedZone,
  isApiLoading = false,
  isStale = false,
  lastUpdated = null,
  session = null,
  onOpenAuthModal,
}) {
  const tabs = [
    {
      id: 'dashboard',
      label: 'AeroSense Dashboard',
      shortLabel: 'Dashboard',
      icon: Wind,
      badge: `${aqi} AQI`,
    },
    {
      id: 'hepa',
      label: '3D HEPA Chamber',
      shortLabel: '3D HEPA',
      icon: Shield,
      badge: 'H13 3D',
    },
    {
      id: 'earthmap',
      label: 'Global AQI & Earth Map',
      shortLabel: 'Earth Map',
      icon: Globe,
      badge: 'Live Map',
    },
  ];

  const handleToggleTheme = () => {
    soundEffects.playPop(isDarkMode ? 440 : 580);
    setIsDarkMode(!isDarkMode);
  };

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    soundEffects.playPop(newMode === 'aws_live' ? 620 : 480);
    if (setMode) setMode(newMode);
  };

  return (
    <header className="glass-panel sticky top-2 sm:top-3 z-40 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/80 dark:border-slate-700/80 shadow-md backdrop-blur-xl mb-4 sm:mb-6 transition-all duration-700">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shadow-md shrink-0">
              <Wind className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
                  AeroSense 3D
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-900 text-white tracking-wide">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
                Ambient Environmental Intelligence & AWS BuildingTelemetry
              </p>
            </div>
          </div>

          {/* Mode Switcher Pill (Local Simulation vs AWS Live) */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              onClick={() => handleModeSwitch('simulation')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 ${
                mode === 'simulation'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Run offline Physics & IoT simulation loop"
            >
              <Radio className="w-3 h-3" />
              <span>Sim</span>
            </button>
            <button
              onClick={() => handleModeSwitch('aws_live')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 ${
                mode === 'aws_live'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Connect to AWS Live API Gateway & DynamoDB"
            >
              <Server className="w-3 h-3" />
              <span>AWS Live</span>
            </button>
          </div>
        </div>

        {/* Central Module Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 w-full lg:w-auto justify-between sm:justify-center overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all relative shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs scale-100'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[11px]">{tab.shortLabel}</span>
                <span
                  className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Zone Selector, AWS Connection Status, Auth & Theme Toggle */}
        <div className="flex items-center gap-2 flex-wrap justify-end w-full lg:w-auto">
          {/* AWS Zone Selector (Only visible in AWS Live mode) */}
          {mode === 'aws_live' && zones && zones.length > 0 && (
            <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone && setSelectedZone(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {z.name || z.zone_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connection Status Pill */}
          {mode === 'aws_live' ? (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold ${
                isStale
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              }`}
            >
              {isApiLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600 dark:text-emerald-400" />
              ) : isStale ? (
                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              )}
              <span>{isStale ? 'STALE' : isApiLoading ? 'POLLING...' : 'AWS LIVE'}</span>
              {lastUpdated && <span className="opacity-60 hidden sm:inline">({lastUpdated})</span>}
            </div>
          ) : (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-semibold ${theme.badgeBg}`}>
              <span className={`w-2 h-2 rounded-full ${theme.pulseColor} animate-pulse`}></span>
              <span>{theme.badge}</span>
            </div>
          )}

          {/* Cognito Auth Status Button */}
          <button
            onClick={onOpenAuthModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold shadow-2xs transition-all active:scale-95 ${
              session
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
            title="AWS Cognito Auth Settings"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">{session ? session.username : 'Cognito Auth'}</span>
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            onClick={handleToggleTheme}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
