/**
 * AeroSense login screen
 * -----------------------------------------------------------------------------
 * The only thing rendered while unauthenticated. It never holds a client
 * secret: every credential operation is a POST to the auth Lambda, which
 * computes SECRET_HASH server-side.
 *
 * Views: signIn | challenge | forgot | reset | confirm
 */

import React, { useState } from 'react';
import {
  KeyRound, User, Lock, ShieldCheck, AlertTriangle, CheckCircle2,
  RefreshCw, Wind, ArrowLeft, MailCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';

const VIEWS = {
  SIGN_IN: 'signIn',
  CHALLENGE: 'challenge',
  FORGOT: 'forgot',
  RESET: 'reset',
  CONFIRM: 'confirm',
};

const inputClass =
  'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60';

const labelClass = 'text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5';

export default function LoginScreen() {
  const {
    login, error, clearError, challenge, completeChallenge, cancelChallenge,
    configError, isBusy, forgotPassword, confirmForgotPassword,
    confirmSignUp, resendConfirmationCode,
  } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [view, setView] = useState(VIEWS.SIGN_IN);
  const [notice, setNotice] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [localBusy, setLocalBusy] = useState(false);

  // A challenge raised by Cognito takes over the form until it is resolved.
  const activeView = challenge ? VIEWS.CHALLENGE : view;
  const busy = isBusy || localBusy;
  const shownError = localError || error?.message || null;

  const resetFeedback = () => {
    setNotice(null);
    setLocalError(null);
    clearError();
  };

  const goTo = (next) => {
    resetFeedback();
    setCode('');
    setNewPassword('');
    setView(next);
  };

  /** Run an async auth operation, surfacing its real outcome either way. */
  const run = async (fn, successNotice = null, onSuccess = null) => {
    resetFeedback();
    setLocalBusy(true);
    try {
      const message = await fn();
      setNotice(typeof message === 'string' && message ? message : successNotice);
      if (onSuccess) onSuccess();
    } catch (err) {
      setLocalError(err?.message || 'The request could not be completed.');
    } finally {
      setLocalBusy(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setLocalError('Enter both a username and a password.');
      return;
    }
    resetFeedback();
    try {
      await login(username.trim(), password);
      // On success the guard swaps this screen for the dashboard.
    } catch (err) {
      // An unconfirmed account is actionable, so route the user to the code form.
      if (err?.code === 'USER_NOT_CONFIRMED') {
        setView(VIEWS.CONFIRM);
        setLocalError('This account is not confirmed yet. Enter the code sent to your email.');
      } else if (err?.code === 'PASSWORD_RESET_REQUIRED') {
        setView(VIEWS.FORGOT);
        setLocalError('A password reset is required before you can sign in.');
      }
      // Other failures are already in `error` from the provider.
    } finally {
      setPassword('');
    }
  };

  const handleChallenge = async (event) => {
    event.preventDefault();
    resetFeedback();
    try {
      if (challenge.challengeName === 'NEW_PASSWORD_REQUIRED') {
        if (!newPassword) {
          setLocalError('Choose a new password to continue.');
          return;
        }
        await completeChallenge({ challengeName: challenge.challengeName, newPassword });
      } else {
        if (!code.trim()) {
          setLocalError('Enter the verification code.');
          return;
        }
        await completeChallenge({ challengeName: challenge.challengeName, code: code.trim() });
      }
    } catch {
      // `error` from the provider is rendered below.
    } finally {
      setNewPassword('');
      setCode('');
    }
  };

  const title = {
    [VIEWS.SIGN_IN]: 'Sign in to AeroSense',
    [VIEWS.CHALLENGE]: 'Additional verification required',
    [VIEWS.FORGOT]: 'Reset your password',
    [VIEWS.RESET]: 'Choose a new password',
    [VIEWS.CONFIRM]: 'Confirm your account',
  }[activeView];

  const subtitle = {
    [VIEWS.SIGN_IN]: 'AWS Cognito • Secure operator access',
    [VIEWS.CHALLENGE]: 'Cognito has not issued a session yet',
    [VIEWS.FORGOT]: "We'll email a reset code",
    [VIEWS.RESET]: 'Enter the code from your email',
    [VIEWS.CONFIRM]: 'Enter the code from your email',
  }[activeView];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white flex items-center justify-center shadow-xl">
            <Wind className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-center">
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">AeroSense 3D</h1>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Ambient Environmental Intelligence &amp; AWS BuildingTelemetry
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Configuration failure outranks everything: nothing can work. */}
            {configError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{configError}</span>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{notice}</span>
              </div>
            )}

            {shownError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{shownError}</span>
              </div>
            )}

            {/* ---------------------------------------------------- sign in -- */}
            {activeView === VIEWS.SIGN_IN && (
              <form onSubmit={handleSignIn} className="space-y-4" aria-label="Sign in">
                <div className="space-y-1">
                  <label htmlFor="as-username" className={labelClass}>
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Cognito username or email</span>
                  </label>
                  <input
                    id="as-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={busy || Boolean(configError)}
                    placeholder="operator@aerosense.io"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="as-password" className={labelClass}>
                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Password</span>
                  </label>
                  <input
                    id="as-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={busy || Boolean(configError)}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || Boolean(configError)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:from-indigo-700 hover:to-slate-900 active:scale-95 transition disabled:opacity-50 disabled:active:scale-100"
                >
                  {busy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sign in</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => goTo(VIEWS.FORGOT)}
                    disabled={busy}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(VIEWS.CONFIRM)}
                    disabled={busy}
                    className="text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                  >
                    Confirm a new account
                  </button>
                </div>
              </form>
            )}

            {/* -------------------------------------------------- challenge -- */}
            {activeView === VIEWS.CHALLENGE && (
              <form onSubmit={handleChallenge} className="space-y-4" aria-label="Complete challenge">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cognito requires <span className="font-mono font-bold">{challenge.challengeName}</span> before
                  issuing a session.
                </p>

                {challenge.challengeName === 'NEW_PASSWORD_REQUIRED' ? (
                  <div className="space-y-1">
                    <label htmlFor="as-newpass" className={labelClass}>
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>New password</span>
                    </label>
                    <input
                      id="as-newpass"
                      type="password"
                      autoComplete="new-password"
                      required
                      disabled={busy}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor="as-mfa" className={labelClass}>
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Verification code</span>
                    </label>
                    <input
                      id="as-mfa"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      disabled={busy}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{busy ? 'Verifying…' : 'Continue'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    cancelChallenge();
                    goTo(VIEWS.SIGN_IN);
                  }}
                  className="w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:underline flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to sign in</span>
                </button>
              </form>
            )}

            {/* ----------------------------------------------------- forgot -- */}
            {activeView === VIEWS.FORGOT && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!username.trim()) {
                    setLocalError('Enter your username or email first.');
                    return;
                  }
                  run(() => forgotPassword(username.trim()), null, () => setView(VIEWS.RESET));
                }}
                className="space-y-4"
                aria-label="Request password reset"
              >
                <div className="space-y-1">
                  <label htmlFor="as-forgot-user" className={labelClass}>
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Cognito username or email</span>
                  </label>
                  <input
                    id="as-forgot-user"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={busy}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
                  <span>{busy ? 'Sending…' : 'Send reset code'}</span>
                </button>

                <BackToSignIn onClick={() => goTo(VIEWS.SIGN_IN)} />
              </form>
            )}

            {/* ------------------------------------------------------ reset -- */}
            {activeView === VIEWS.RESET && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!code.trim() || !newPassword) {
                    setLocalError('Enter both the reset code and a new password.');
                    return;
                  }
                  run(
                    () => confirmForgotPassword(username.trim(), code.trim(), newPassword),
                    null,
                    () => setView(VIEWS.SIGN_IN)
                  );
                }}
                className="space-y-4"
                aria-label="Confirm password reset"
              >
                <CodeField value={code} onChange={setCode} disabled={busy} id="as-reset-code" />
                <div className="space-y-1">
                  <label htmlFor="as-reset-pass" className={labelClass}>
                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>New password</span>
                  </label>
                  <input
                    id="as-reset-pass"
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{busy ? 'Updating…' : 'Set new password'}</span>
                </button>

                <BackToSignIn onClick={() => goTo(VIEWS.SIGN_IN)} />
              </form>
            )}

            {/* ---------------------------------------------------- confirm -- */}
            {activeView === VIEWS.CONFIRM && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!username.trim() || !code.trim()) {
                    setLocalError('Enter both your username and the confirmation code.');
                    return;
                  }
                  run(
                    () => confirmSignUp(username.trim(), code.trim()),
                    null,
                    () => setView(VIEWS.SIGN_IN)
                  );
                }}
                className="space-y-4"
                aria-label="Confirm account"
              >
                <div className="space-y-1">
                  <label htmlFor="as-confirm-user" className={labelClass}>
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Cognito username or email</span>
                  </label>
                  <input
                    id="as-confirm-user"
                    type="text"
                    autoComplete="username"
                    required
                    disabled={busy}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <CodeField value={code} onChange={setCode} disabled={busy} id="as-confirm-code" />

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{busy ? 'Confirming…' : 'Confirm account'}</span>
                </button>

                <button
                  type="button"
                  disabled={busy || !username.trim()}
                  onClick={() => run(() => resendConfirmationCode(username.trim()))}
                  className="w-full text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                >
                  Resend confirmation code
                </button>

                <BackToSignIn onClick={() => goTo(VIEWS.SIGN_IN)} />
              </form>
            )}
          </div>

          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
            <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium text-center leading-relaxed">
              Credentials are exchanged with AWS Cognito through the AeroSense auth service. No client secret is
              held in this browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackToSignIn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:underline flex items-center justify-center gap-1"
    >
      <ArrowLeft className="w-3 h-3" />
      <span>Back to sign in</span>
    </button>
  );
}

function CodeField({ value, onChange, disabled, id }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
        <span>Verification code</span>
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        disabled={disabled}
        placeholder="123456"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
