/**
 * Shared primitives for the authentication screens.
 *
 * Centralised so sign-in, create-account, confirm, forgot and reset all use the
 * same input height, button height, radius, spacing and focus treatment, and so
 * feedback always renders in exactly one place.
 */
import React, { useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Check, X } from 'lucide-react';

/** One consistent control height across every field and button. */
export const CONTROL = 'h-11 rounded-xl text-sm';

const FIELD_BASE =
  `w-full ${CONTROL} px-3.5 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 ` +
  'border border-slate-300 dark:border-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition';

export function Field({ label, icon: Icon, hint, error, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-indigo-500 shrink-0" aria-hidden="true" />}
        <span>{label}</span>
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid = false, className = '', ...props }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={`${FIELD_BASE} ${invalid ? 'border-rose-400 dark:border-rose-700 focus:ring-rose-500' : ''} ${className}`}
    />
  );
}

/** Password field with a visibility toggle that keeps the control height. */
export function PasswordInput({ invalid = false, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={`${FIELD_BASE} pr-11 ${invalid ? 'border-rose-400 dark:border-rose-700 focus:ring-rose-500' : ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

/**
 * Verification-code field: one-time-code autocomplete, numeric keypad on
 * mobile, and paste-friendly (non-digits are stripped rather than rejected).
 */
export function CodeInput({ value, onChange, disabled, id, length = 6 }) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={length}
      required
      disabled={disabled}
      placeholder={'0'.repeat(length)}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
      className={`${FIELD_BASE} text-center font-mono text-lg tracking-[0.5em] pl-[0.5em]`}
    />
  );
}

/** The single primary action on a screen. */
export function PrimaryButton({ busy = false, busyLabel, icon: Icon, children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`w-full ${CONTROL} px-4 font-bold text-white flex items-center justify-center gap-2 shadow-lg
        bg-gradient-to-r from-indigo-600 to-slate-800 hover:from-indigo-700 hover:to-slate-900
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900
        active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      <span>{busy ? busyLabel || 'Working…' : children}</span>
    </button>
  );
}

/** Unobtrusive secondary action. */
export function LinkButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={`text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline
        focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-0.5
        disabled:opacity-50 disabled:no-underline transition ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The one place feedback appears on any auth screen. Rendering a single
 * component prevents the duplicated banners the old confirm screen showed.
 */
export function Feedback({ error, notice }) {
  if (!error && !notice) return null;
  const isError = Boolean(error);
  const Icon = isError ? AlertTriangle : CheckCircle2;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
        isError
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
      <span className="min-w-0">{error || notice}</span>
    </div>
  );
}

/** Live checklist of the Cognito password policy. */
export function PasswordRules({ rules, show }) {
  const headingId = useId();
  if (!show) return null;
  return (
    <ul aria-labelledby={headingId} className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
      <li id={headingId} className="sr-only">
        Password requirements
      </li>
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-1.5 text-[11px] ${
            rule.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {rule.met ? (
            <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <X className="w-3 h-3 shrink-0 opacity-50" aria-hidden="true" />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
