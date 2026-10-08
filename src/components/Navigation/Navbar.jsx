import React from 'react';
import { Wind, Shield, Globe, Sun, Moon } from 'lucide-react';
import { soundEffects } from '../../utils/soundEffects';

export default function Navbar({
  activeTab,
  setActiveTab,
  theme,
  aqi,
  humidity,
  isDarkMode = false,
  setIsDarkMode,
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

  return (
    <header className="glass-panel sticky top-2 sm:top-3 z-40 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/80 dark:border-slate-700/80 shadow-md backdrop-blur-xl mb-4 sm:mb-6 transition-all duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
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
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[220px] sm:max-w-none">
                Ambient Environmental Intelligence & Closed-Loop Digital Twin
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: Status Pill + Theme Toggle */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={handleToggleTheme}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs"
              title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 shrink-0">
              <span className={`w-2 h-2 rounded-full ${theme.pulseColor} animate-ping`}></span>
              <span className="dark:text-slate-200">{theme.badge}</span>
            </div>
          </div>
        </div>

        {/* Central Module Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 sm:p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 w-full md:w-auto justify-between sm:justify-center overflow-x-auto scrollbar-none">
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
                <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-mono ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                    : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Right Controls: Theme Switcher & Ambient Badges */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Dark / Light Theme Toggle Pill Button */}
          <button
            onClick={handleToggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95 group"
            title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition-transform" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600 group-hover:-rotate-12 transition-transform" />
                <span>Dark</span>
              </>
            )}
          </button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${theme.badgeBg}`}>
            <span className={`w-2 h-2 rounded-full ${theme.pulseColor} animate-pulse`}></span>
            <span>{theme.badge}</span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            AWS 2026
          </div>
        </div>
      </div>
    </header>
  );
}
