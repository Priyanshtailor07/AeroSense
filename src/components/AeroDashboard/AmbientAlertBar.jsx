import React from 'react';
import { Droplets, ShieldCheck, Wind, ArrowRight, Server, Radio, Bell } from 'lucide-react';
import { THEME_MODES } from '../../utils/themeEngine';
import { formatNumber } from '../../utils/formatNumber';

/**
 * Ambient condition strip and secondary notification list.
 *
 * Alert hierarchy: App owns the single primary active-hazard banner at the top
 * of the page, including the alarm controls. This component is deliberately
 * quiet — it previously rendered its own flashing `alert-flash-banner`, so a
 * hazard produced two competing red banners with separately-tracked alarm
 * state. It now reports conditions and lists backend notifications, and never
 * claims an alarm state of its own.
 */

const SEVERITY = {
  critical: {
    label: 'Critical',
    dot: 'bg-rose-500',
    chip: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
  },
  warning: {
    label: 'Warning',
    dot: 'bg-amber-500',
    chip: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
  },
  info: {
    label: 'Info',
    dot: 'bg-slate-400',
    chip: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  },
};

/** Only renders a time when the record actually carried one. */
function alertTime(alert) {
  if (!alert?.timestampMs) return null;
  try {
    return new Date(alert.timestampMs).toLocaleTimeString();
  } catch {
    return null;
  }
}

export default function AmbientAlertBar({
  theme,
  aqi,
  humidity,
  pm25,
  onOpenHepa,
  mode = 'simulation',
  selectedZone = null,
  liveAlerts = [],
}) {
  const alerts = Array.isArray(liveAlerts) ? liveAlerts : [];
  const isLive = mode === 'aws_live';

  const ConditionIcon =
    theme.mode === THEME_MODES.RAIN ? Droplets : theme.mode === THEME_MODES.CLEAN ? ShieldCheck : Wind;

  const iconTone =
    theme.mode === THEME_MODES.RAIN
      ? 'text-sky-600 dark:text-sky-400'
      : theme.mode === THEME_MODES.CLEAN
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400';

  return (
    <section
      aria-label="Ambient conditions and notifications"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 shadow-sm overflow-hidden"
    >
      {/* Condition summary */}
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
            <ConditionIcon className={`w-5 h-5 ${iconTone}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="as-section-title text-sm text-slate-900 dark:text-white">{theme.label}</h2>
              <span
                className={`as-label px-2 py-0.5 rounded-md border ${
                  isLive
                    ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-900'
                    : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-900'
                }`}
              >
                {isLive ? (
                  <span className="inline-flex items-center gap-1">
                    <Server className="w-3 h-3" aria-hidden="true" />
                    AWS Live{selectedZone ? ` · ${selectedZone}` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Radio className="w-3 h-3" aria-hidden="true" />
                    Simulated
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{theme.sublabel}</p>
          </div>
        </div>

        {/* Key readings. Outdoor and indoor are labelled separately because
            they come from different sources and must not read as one place. */}
        <div className="flex items-center gap-4 flex-wrap shrink-0">
          <Reading
            label="Outdoor AQI"
            value={formatNumber(aqi, { digits: 0 })}
            hint={isLive ? 'From the zone record' : 'Simulated'}
          />
          <Reading label="Indoor PM2.5" value={formatNumber(pm25, { digits: 1 })} unit="µg/m³" />
          <Reading label="Humidity" value={formatNumber(humidity, { digits: 0 })} unit="%" />

          <button
            onClick={onOpenHepa}
            className="as-control as-focus inline-flex items-center gap-2 px-3.5 text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white active:scale-[0.98] transition shrink-0"
          >
            <span>Open 3D HEPA view</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Secondary notifications: the backend's own alert strings. */}
      {alerts.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="px-4 sm:px-5 py-2.5 flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <h3 className="as-label">
              Notifications from AWS{selectedZone ? ` · ${selectedZone}` : ''} ({alerts.length})
            </h3>
          </div>
          <ul className="px-4 sm:px-5 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
            {alerts.slice(0, 6).map((alert) => {
              const tone = SEVERITY[alert.severity] || SEVERITY.info;
              const time = alertTime(alert);
              return (
                <li
                  key={alert.id}
                  className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${tone.dot}`} aria-hidden="true" />
                  <span className={`as-label px-1.5 py-0.5 rounded border shrink-0 ${tone.chip}`}>{tone.label}</span>
                  <span className="min-w-0 flex-1 break-words">{alert.message}</span>
                  {/* Shown only when the record carried a timestamp. */}
                  {time && (
                    <time className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0 hidden sm:block">
                      {time}
                    </time>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Reading({ label, value, unit, hint }) {
  return (
    <div className="min-w-0">
      <p className="as-label" title={hint || undefined}>
        {label}
      </p>
      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm tabular-nums whitespace-nowrap">
        {value}
        {unit && <span className="text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
