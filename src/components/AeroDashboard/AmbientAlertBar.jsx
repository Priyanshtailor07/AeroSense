import React from 'react';
import { Droplets, ShieldCheck, Wind, Sparkles, ArrowRight, ShieldAlert, Zap, Server, AlertTriangle } from 'lucide-react';
import { THEME_MODES } from '../../utils/themeEngine';

export default function AmbientAlertBar({
  theme,
  aqi,
  humidity,
  pm25,
  onOpenHepa,
  mode = 'simulation',
  selectedZone = 'Zone-1',
  isApiLoading = false,
  isStale = false,
  lastUpdated = null,
  liveAlerts = [],
}) {
  const isAlert = theme.mode === THEME_MODES.ALERT || (liveAlerts && liveAlerts.length > 0);

  const getIcon = () => {
    if (isAlert) {
      return <ShieldAlert className="w-6 h-6 text-white animate-bounce" />;
    }
    switch (theme.mode) {
      case THEME_MODES.RAIN:
        return <Droplets className="w-5 h-5 text-sky-600 animate-pulse" />;
      case THEME_MODES.CLEAN:
        return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
      default:
        return <Wind className="w-5 h-5 text-amber-600" />;
    }
  };

  const activeAlertMsg = liveAlerts && liveAlerts.length > 0 ? liveAlerts[0].message : null;

  return (
    <div
      className={`w-full rounded-2xl transition-all duration-500 relative overflow-hidden shadow-lg ${
        isAlert
          ? 'alert-flash-banner p-5 text-white border-2 border-rose-400 shadow-rose-500/30'
          : `glass-panel p-4 border ${theme.cardBorder} dark:border-slate-800`
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute -right-20 -top-20 w-64 h-64 rounded-full opacity-30 blur-3xl pointer-events-none transition-colors duration-700 ${
          isAlert
            ? 'bg-rose-600'
            : theme.mode === THEME_MODES.RAIN
            ? 'bg-sky-500'
            : theme.mode === THEME_MODES.CLEAN
            ? 'bg-emerald-500'
            : 'bg-amber-500'
        }`}
      />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5">
          <div
            className={`p-2.5 rounded-xl flex items-center justify-center shadow-md ${
              isAlert ? 'bg-rose-950/80 border border-rose-400' : theme.badgeBg
            }`}
          >
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-black text-base tracking-tight ${
                  isAlert ? 'text-white' : 'text-slate-900 dark:text-white'
                }`}
              >
                {activeAlertMsg ? 'AWS Telemetry Alert' : theme.label}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider border shadow-xs ${
                  isAlert ? 'bg-white text-rose-800 border-white' : theme.badgeBg
                }`}
              >
                {activeAlertMsg ? 'BACKEND ANOMALY' : theme.badge}
              </span>
              {mode === 'aws_live' && (
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" />
                  <span>AWS Live ({selectedZone})</span>
                </span>
              )}
              {isAlert && (
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-300"></span>
                </span>
              )}
            </div>
            <p
              className={`text-xs mt-0.5 max-w-2xl font-medium ${
                isAlert ? 'text-rose-100' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {activeAlertMsg || theme.sublabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div
            className={`hidden sm:flex items-center gap-3 text-xs font-bold px-3 py-1.5 rounded-xl border shadow-xs ${
              isAlert
                ? 'bg-black/40 text-white border-white/20'
                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700'
            }`}
          >
            <span>
              AQI:{' '}
              <strong className={isAlert ? 'text-rose-300 font-mono text-sm' : 'text-slate-900 dark:text-white'}>
                {aqi}
              </strong>
            </span>
            <span className="opacity-40">•</span>
            <span>
              RH:{' '}
              <strong className={isAlert ? 'text-sky-300 font-mono' : 'text-slate-900 dark:text-white'}>
                {humidity}%
              </strong>
            </span>
            <span className="opacity-40">•</span>
            <span>
              PM2.5:{' '}
              <strong className={isAlert ? 'text-amber-300 font-mono' : 'text-slate-900 dark:text-white'}>
                {pm25} µg/m³
              </strong>
            </span>
          </div>

          <button
            onClick={onOpenHepa}
            className={`flex items-center gap-2 text-xs font-black px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 group shrink-0 ${
              isAlert
                ? 'bg-white text-rose-950 hover:bg-rose-50 shadow-rose-900/40'
                : 'bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500'
            }`}
          >
            {isAlert ? (
              <Zap className="w-4 h-4 text-rose-600 animate-pulse" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 dark:text-white group-hover:rotate-12 transition-transform" />
            )}
            <span>{isAlert ? 'Engage Emergency HEPA' : '3D HEPA Chamber'}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
