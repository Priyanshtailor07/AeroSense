import React from 'react';
import {
  Wind, Shield, Globe, Sun, Moon, Server, Radio, RefreshCw,
  ShieldCheck, ShieldAlert, AlertTriangle, Layers, LogOut,
} from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';

/**
 * Application header.
 *
 * Structured as two rows rather than one compressed strip:
 *   row 1 — identity, operating mode, session and account actions
 *   row 2 — section navigation, zone selector and connection status
 *
 * Every control shares one height (`as-control`) so nothing is clipped, and
 * icon-only buttons carry accessible names.
 */

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Wind },
  { id: 'hepa', label: '3D HEPA Chamber', icon: Shield },
  { id: 'earthmap', label: 'Global AQI Map', icon: Globe },
];

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  isDarkMode = false,
  setIsDarkMode,
  mode = 'simulation',
  setMode,
  zones = [],
  selectedZone = null,
  setSelectedZone,
  isApiLoading = false,
  isStale = false,
  lastUpdated = null,
  session = null,
  isVerified = false,
  isAuthBusy = false,
  onSignOut,
}) {
  const isLive = mode === 'aws_live';

  const handleToggleTheme = () => {
    soundEffects.playPop(isDarkMode ? 440 : 580);
    setIsDarkMode(!isDarkMode);
  };

  const handleModeSwitch = (next) => {
    if (next === mode) return;
    soundEffects.playPop(next === 'aws_live' ? 620 : 480);
    if (setMode) setMode(next);
  };

  return (
    <header className="sticky top-2 sm:top-3 z-40 mb-4 sm:mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm">
      {/* Row 1 — identity, mode, session */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shrink-0">
            <Wind className="w-4.5 h-4.5 text-teal-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="as-section-title text-sm sm:text-base text-slate-900 dark:text-white truncate">
              AeroSense 3D
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              Environmental intelligence &amp; HVAC optimisation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Operating mode */}
          <div
            role="group"
            aria-label="Operating mode"
            className="as-control flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <ModeButton active={!isLive} onClick={() => handleModeSwitch('simulation')} icon={Radio} label="Sim" title="Local simulated data" />
            <ModeButton active={isLive} onClick={() => handleModeSwitch('aws_live')} icon={Server} label="AWS Live" title="Authenticated AWS telemetry" live />
          </div>

          {/* Session state. Reflects a token the API authorizer accepted. */}
          <div
            className={`as-control hidden md:flex items-center gap-1.5 px-2.5 text-xs font-bold border ${
              isVerified
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900'
                : 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900'
            }`}
            title={
              isVerified
                ? 'Verified against the AeroSense API authorizer'
                : 'Signed in; awaiting confirmation from a protected API call'
            }
          >
            {isVerified ? <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> : <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />}
            <span className="hidden xl:inline">{isVerified ? 'Verified session' : 'Verifying…'}</span>
            {session?.displayName && (
              <span className="font-mono text-[10px] opacity-80 max-w-[11rem] truncate" title={session.displayName}>
                {session.displayName}
              </span>
            )}
          </div>

          <button
            onClick={handleToggleTheme}
            aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            className="as-control as-focus w-9 flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
          </button>

          <button
            onClick={onSignOut}
            disabled={isAuthBusy}
            aria-label="Sign out of AeroSense"
            className="as-control as-focus flex items-center gap-1.5 px-2.5 text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 disabled:opacity-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{isAuthBusy ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </div>

      {/* Row 2 — navigation, zone, connection */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-t border-slate-200 dark:border-slate-800 min-w-0">
        <nav aria-label="Sections" className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`as-control as-focus flex items-center gap-2 px-3 text-xs font-bold whitespace-nowrap shrink-0 transition ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* Zone selector. The API returns ids such as "zone-01" and no
              display names, so the id is shown verbatim. */}
          {isLive && zones.length > 0 && (
            <div className="as-control flex items-center gap-1.5 pl-2.5 pr-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
              <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" aria-hidden="true" />
              <label htmlFor="zone-select" className="as-label hidden sm:inline">
                Zone
              </label>
              <select
                id="zone-select"
                value={selectedZone || ''}
                onChange={(e) => setSelectedZone && setSelectedZone(e.target.value)}
                disabled={zones.length <= 1}
                title={zones.length <= 1 ? 'The API currently reports a single zone' : 'Select a telemetry zone'}
                className="as-focus bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer disabled:cursor-default py-1 pr-1"
              >
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id} className="bg-white dark:bg-slate-900">
                    {z.name || z.zone_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connection status */}
          {isLive ? (
            <div
              className={`as-control flex items-center gap-1.5 px-2.5 text-[11px] font-mono font-bold border ${
                isStale
                  ? 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900'
                  : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900'
              }`}
              role="status"
            >
              {isApiLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : isStale ? (
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
              <span>{isStale ? 'STALE' : isApiLoading ? 'SYNCING' : 'LIVE'}</span>
              {/* Only shown when a poll has actually succeeded. */}
              {lastUpdated && (
                <span className="opacity-60 font-normal hidden lg:inline" title="Last successful poll">
                  {lastUpdated}
                </span>
              )}
            </div>
          ) : (
            <div className={`as-control hidden sm:flex items-center gap-2 px-2.5 text-xs font-semibold border ${theme.badgeBg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${theme.pulseColor}`} aria-hidden="true" />
              <span>{theme.badge}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ModeButton({ active, onClick, icon: Icon, label, title, live = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`as-focus h-full px-2.5 rounded-[0.5rem] text-[11px] font-bold flex items-center gap-1 transition ${
        active
          ? live
            ? 'bg-teal-600 text-white shadow-sm'
            : 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
