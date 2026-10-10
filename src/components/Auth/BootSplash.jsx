import React from 'react';
import { Wind } from 'lucide-react';

/**
 * Minimal branded screen shown while the stored session is being verified
 * against Cognito. Deliberately renders none of the dashboard: no 3D scene, no
 * telemetry cards, no charts, no controls.
 */
export default function BootSplash({ label = 'Verifying secure session…' }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shadow-xl">
          <Wind className="w-7 h-7 text-emerald-400" />
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="font-extrabold tracking-tight text-slate-900 dark:text-white">AeroSense 3D</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}
