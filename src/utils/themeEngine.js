/**
 * Theme Engine & Environmental State Evaluator
 * Follows strict priority rules defined in RULES.md:
 * 1. Critical AQI (AQI > 150 or PM2.5 > 55 µg/m³) -> Crimson Alert
 * 2. High Humidity (Humidity > 75%) -> Moisture Blue
 * 3. Clean Mint Green (AQI <= 50) -> Sage / Emerald
 * 4. Moderate (51 - 150) -> Warm Amber
 */

export const THEME_MODES = {
  CLEAN: 'clean',
  RAIN: 'rain',
  ALERT: 'alert',
  MODERATE: 'moderate',
};

export function getEnvironmentalTheme(aqi, humidity, pm25) {
  if (aqi > 150 || pm25 > 55) {
    return {
      mode: THEME_MODES.ALERT,
      label: 'Critical Pollution Alert',
      sublabel: 'Harmful particulate levels detected. HEPA filtration & sealed enclosure advised.',
      badge: 'Unhealthy / Danger',
      bgGradient: 'from-rose-50 via-red-50 to-orange-50',
      darkBgGradient: 'from-zinc-950 via-red-950/40 to-neutral-950',
      accentColor: 'text-rose-600',
      accentBg: 'bg-rose-500',
      accentBorder: 'border-rose-300',
      glowClass: 'glow-crimson',
      pulseColor: 'bg-rose-500',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      cardBorder: 'border-rose-200/80 hover:border-rose-400',
      primaryHex: '#ef4444',
      statusIcon: 'alert-triangle',
      soundFrequency: 330,
    };
  }

  if (humidity > 75) {
    return {
      mode: THEME_MODES.RAIN,
      label: 'Moist / Rainy Atmosphere',
      sublabel: 'Elevated relative humidity. Moisture droplet precipitation active.',
      badge: 'High Humidity',
      bgGradient: 'from-sky-50 via-blue-50 to-indigo-50',
      darkBgGradient: 'from-slate-950 via-blue-950/40 to-cyan-950/30',
      accentColor: 'text-sky-600',
      accentBg: 'bg-sky-500',
      accentBorder: 'border-sky-300',
      glowClass: 'glow-cyan',
      pulseColor: 'bg-sky-500',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
      cardBorder: 'border-sky-200/80 hover:border-sky-400',
      primaryHex: '#0ea5e9',
      statusIcon: 'droplets',
      soundFrequency: 520,
    };
  }

  if (aqi <= 50) {
    return {
      mode: THEME_MODES.CLEAN,
      label: 'Pure Alpine Atmosphere',
      sublabel: 'Optimal clean air quality. Particles thoroughly filtered.',
      badge: 'Pristine Clean',
      bgGradient: 'from-emerald-300/90 via-emerald-100/95 to-green-200/90',
      darkBgGradient: 'from-slate-950 via-emerald-950/40 to-teal-950/40',
      accentColor: 'text-emerald-700',
      accentBg: 'bg-emerald-600',
      accentBorder: 'border-emerald-400',
      glowClass: 'glow-emerald',
      pulseColor: 'bg-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-400',
      cardBorder: 'border-emerald-300 hover:border-emerald-500',
      primaryHex: '#059669',
      statusIcon: 'shield-check',
      soundFrequency: 440,
    };
  }

  return {
    mode: THEME_MODES.MODERATE,
    label: 'Moderate Air Quality',
    sublabel: 'Acceptable ambient air; sensitive individuals should consider light filtering.',
    badge: 'Moderate Range',
    bgGradient: 'from-amber-50 via-yellow-50 to-orange-50',
    darkBgGradient: 'from-stone-950 via-amber-950/20 to-neutral-950',
    accentColor: 'text-amber-600',
    accentBg: 'bg-amber-500',
    accentBorder: 'border-amber-300',
    glowClass: '',
    pulseColor: 'bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    cardBorder: 'border-amber-200/80 hover:border-amber-400',
    primaryHex: '#f59e0b',
    statusIcon: 'wind',
    soundFrequency: 390,
  };
}
