import React from 'react';
import { Wind, Shield, Globe, Sparkles, Activity, Layers, ExternalLink } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, theme, aqi, humidity }) {
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

  return (
    <header className="glass-panel sticky top-2 sm:top-3 z-40 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/80 shadow-md backdrop-blur-xl mb-4 sm:mb-6 transition-all duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shadow-md shrink-0">
              <Wind className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">AeroSense 3D</span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-900 text-white tracking-wide">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate max-w-[220px] sm:max-w-none">
                Ambient Environmental Intelligence & Global Earth Explorer
              </p>
            </div>
          </div>

          {/* Current Ambient Status Pill (Mobile) */}
          <div className="flex md:hidden items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-white/70 shrink-0">
            <span className={`w-2 h-2 rounded-full ${theme.pulseColor} animate-ping`}></span>
            <span>{theme.badge}</span>
          </div>
        </div>

        {/* Central Module Tabs (Fully responsive with short mobile labels) */}
        <nav className="flex items-center gap-1 bg-slate-100/90 p-1 sm:p-1.5 rounded-xl border border-slate-200/80 w-full md:w-auto justify-between sm:justify-center overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all relative shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs scale-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-[11px]">{tab.shortLabel}</span>
                <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-mono ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/60 text-slate-500'
                }`}>
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Live Ambient Indicator & Hackathon Badge */}
        <div className="hidden lg:flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${theme.badgeBg}`}>
            <span className={`w-2 h-2 rounded-full ${theme.pulseColor} animate-pulse`}></span>
            <span>{theme.badge}</span>
          </div>

          <div className="text-[11px] font-mono text-slate-500 bg-white/60 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
            AWS Hackathon 2026
          </div>
        </div>
      </div>
    </header>
  );
}
