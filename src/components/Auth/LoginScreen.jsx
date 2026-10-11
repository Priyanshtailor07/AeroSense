/**
 * AeroSense authentication screens.
 * -----------------------------------------------------------------------------
 * The only thing rendered while unauthenticated. No client secret ever reaches
 * this code: every credential operation is a POST to the auth Lambda, which
 * computes SECRET_HASH server-side.
 *
 * Views: signIn | signUp | confirm | challenge | forgot | reset | accessRequest
 *
 * Two rules the flow depends on:
 *   * confirming an email is NOT authentication. After confirmation the user is
 *     returned to sign-in with their email preserved; only a real Cognito
 *     session opens the dashboard.
 *   * the pending email survives navigation between confirm and sign-in, so a
 *     user never has to retype it mid-flow.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyRound, User, Lock, ShieldCheck, Wind, ArrowLeft, MailCheck,
  UserPlus, LogIn, ShieldAlert, MailQuestion,
} from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { checkPassword, isValidEmail, maskEmail } from '../../services/auth';
import {
  Field, TextInput, PasswordInput, CodeInput, PrimaryButton, LinkButton, Feedback, PasswordRules,
} from './authUi';

const VIEWS = {
  SIGN_IN: 'signIn',
  SIGN_UP: 'signUp',
  CONFIRM: 'confirm',
  CHALLENGE: 'challenge',
  FORGOT: 'forgot',
  RESET: 'reset',
  ACCESS_REQUEST: 'accessRequest',
};

const COPY = {
  [VIEWS.SIGN_IN]: { title: 'Sign in', subtitle: 'AWS Cognito • Secure operator access' },
  [VIEWS.SIGN_UP]: { title: 'Create your account', subtitle: 'Register to access AeroSense telemetry' },
  [VIEWS.CONFIRM]: { title: 'Confirm your email', subtitle: 'Enter the code we emailed you' },
  [VIEWS.CHALLENGE]: { title: 'Additional verification', subtitle: 'Cognito has not issued a session yet' },
  [VIEWS.FORGOT]: { title: 'Reset your password', subtitle: "We'll email you a reset code" },
  [VIEWS.RESET]: { title: 'Choose a new password', subtitle: 'Enter the code from your email' },
  [VIEWS.ACCESS_REQUEST]: { title: 'Request access', subtitle: 'Accounts are provisioned by an administrator' },
};

/** Seconds to wait before another code can be requested. */
const RESEND_COOLDOWN_S = 30;

export default function LoginScreen() {
  const {
    login, logout: _logout, error, clearError, challenge, completeChallenge, cancelChallenge,
    configError, isBusy, allowSelfSignup,
    forgotPassword, confirmForgotPassword, confirmSignUp, resendConfirmationCode, signUp,
  } = useAuth();

  const [view, setView] = useState(VIEWS.SIGN_IN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');

  const [notice, setNotice] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [localBusy, setLocalBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // A single in-flight guard for every submit on this screen.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Resend cooldown. Prevents a burst of requests and, with the single
  // feedback region, prevents duplicate "code sent" banners stacking up.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // A Cognito challenge takes over until resolved.
  const activeView = challenge ? VIEWS.CHALLENGE : view;
  const busy = isBusy || localBusy;
  const shownError = localError || error?.message || null;
  const passwordCheck = checkPassword(password);
  const resetCheck = checkPassword(newPassword);

  const resetFeedback = useCallback(() => {
    setNotice(null);
    setLocalError(null);
    setFieldErrors({});
    clearError();
  }, [clearError]);

  /** Move between views, keeping the email but never a password or code. */
  const goTo = useCallback((next) => {
    resetFeedback();
    setPassword('');
    setConfirmPassword('');
    setNewPassword('');
    setCode('');
    setView(next);
  }, [resetFeedback]);

  /**
   * Run an async auth operation exactly once at a time, surfacing its real
   * outcome. Never reports success unless the backend confirmed it.
   */
  const run = useCallback(async (fn, { onSuccess, successNotice } = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    resetFeedback();
    setLocalBusy(true);
    try {
      const result = await fn();
      if (!mountedRef.current) return;
      const message =
        typeof result === 'string' ? result : result?.message || successNotice || null;
      if (message) setNotice(message);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setLocalError(err?.message || 'The request could not be completed.');
      if (err?.code === 'USERNAME_EXISTS') {
        setFieldErrors({ email: 'An account with this email already exists.' });
      } else if (err?.code === 'INVALID_PASSWORD') {
        setFieldErrors({ password: 'This password does not meet the policy.' });
      } else if (err?.code === 'CODE_MISMATCH' || err?.code === 'CODE_EXPIRED') {
        setFieldErrors({ code: err.message });
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLocalBusy(false);
    }
  }, [resetFeedback]);

  /* ------------------------------------------------------------ handlers -- */

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;

    const errors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    if (!password) errors.password = 'Enter your password.';
    if (Object.keys(errors).length) {
      resetFeedback();
      setFieldErrors(errors);
      return;
    }

    inFlightRef.current = true;
    resetFeedback();
    try {
      await login(email.trim(), password);
      // On success the route guard swaps this screen for the dashboard.
    } catch (err) {
      if (!mountedRef.current) return;
      // Unconfirmed and reset-required are actionable: route the user onward.
      if (err?.code === 'USER_NOT_CONFIRMED') {
        setView(VIEWS.CONFIRM);
        setLocalError('This account is not confirmed yet. Enter the code sent to your email.');
      } else if (err?.code === 'PASSWORD_RESET_REQUIRED') {
        setView(VIEWS.FORGOT);
        setLocalError('A password reset is required before you can sign in.');
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setPassword('');
    }
  };

  const handleSignUp = (event) => {
    event.preventDefault();

    const errors = {};
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address.';
    if (!passwordCheck.valid) errors.password = 'This password does not meet the requirements below.';
    if (password !== confirmPassword) errors.confirmPassword = 'The passwords do not match.';
    if (Object.keys(errors).length) {
      resetFeedback();
      setFieldErrors(errors);
      return;
    }

    const trimmed = email.trim();
    run(() => signUp(trimmed, password, trimmed), {
      onSuccess: (result) => {
        setPassword('');
        setConfirmPassword('');
        // Creating an account is not signing in. Go to confirmation, or to
        // sign-in if this pool auto-confirms.
        setView(result?.status === 'CONFIRMED' ? VIEWS.SIGN_IN : VIEWS.CONFIRM);
        if (result?.status !== 'CONFIRMED') setCooldown(RESEND_COOLDOWN_S);
      },
    });
  };

  const handleConfirm = (event) => {
    event.preventDefault();
    const errors = {};
    if (!email.trim()) errors.email = 'Enter the email address you registered with.';
    if (code.length < 6) errors.code = 'Enter the 6-digit code from your email.';
    if (Object.keys(errors).length) {
      resetFeedback();
      setFieldErrors(errors);
      return;
    }

    run(() => confirmSignUp(email.trim(), code), {
      onSuccess: () => {
        setCode('');
        // Confirmed, not authenticated: send them to sign in, email preserved.
        setView(VIEWS.SIGN_IN);
        setNotice('Your email is confirmed. Sign in to continue.');
      },
    });
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    if (!email.trim()) {
      resetFeedback();
      setFieldErrors({ email: 'Enter your email address first.' });
      return;
    }
    run(() => resendConfirmationCode(email.trim()), {
      onSuccess: () => setCooldown(RESEND_COOLDOWN_S),
    });
  };

  const handleChallenge = async (event) => {
    event.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    resetFeedback();
    try {
      if (challenge.challengeName === 'NEW_PASSWORD_REQUIRED') {
        if (!resetCheck.valid) {
          setFieldErrors({ newPassword: 'This password does not meet the requirements.' });
          return;
        }
        await completeChallenge({ challengeName: challenge.challengeName, newPassword });
      } else {
        if (code.length < 6) {
          setFieldErrors({ code: 'Enter the verification code.' });
          return;
        }
        await completeChallenge({ challengeName: challenge.challengeName, code });
      }
    } catch {
      // `error` from the provider renders in the feedback region.
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) {
        setNewPassword('');
        setCode('');
      }
    }
  };

  const handleForgot = (event) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      resetFeedback();
      setFieldErrors({ email: 'Enter a valid email address.' });
      return;
    }
    run(() => forgotPassword(email.trim()), {
      onSuccess: () => {
        setView(VIEWS.RESET);
        setCooldown(RESEND_COOLDOWN_S);
      },
    });
  };

  const handleReset = (event) => {
    event.preventDefault();
    const errors = {};
    if (code.length < 6) errors.code = 'Enter the 6-digit code from your email.';
    if (!resetCheck.valid) errors.newPassword = 'This password does not meet the requirements below.';
    if (Object.keys(errors).length) {
      resetFeedback();
      setFieldErrors(errors);
      return;
    }
    run(() => confirmForgotPassword(email.trim(), code, newPassword), {
      onSuccess: () => {
        setNewPassword('');
        setCode('');
        setView(VIEWS.SIGN_IN);
        setNotice('Your password has been updated. Sign in to continue.');
      },
    });
  };

  const copy = COPY[activeView];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-[26rem]">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 flex items-center justify-center shadow-lg">
            <Wind className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">AeroSense 3D</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Ambient Environmental Intelligence
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <header className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white truncate">
                {copy.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{copy.subtitle}</p>
            </div>
          </header>

          <div className="px-6 py-6 space-y-5">
            {/* Configuration failure outranks everything else. */}
            {configError && <Feedback error={configError} />}

            {/* The single feedback region for this screen. */}
            {!configError && <Feedback error={shownError} notice={notice} />}

            {/* ---------------------------------------------------- sign in -- */}
            {activeView === VIEWS.SIGN_IN && (
              <form noValidate onSubmit={handleSignIn} className="space-y-4" aria-label="Sign in">
                <Field label="Email address" icon={User} htmlFor="as-email" error={fieldErrors.email}>
                  <TextInput
                    id="as-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    required
                    disabled={busy || Boolean(configError)}
                    invalid={Boolean(fieldErrors.email)}
                    placeholder="operator@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field label="Password" icon={Lock} htmlFor="as-password" error={fieldErrors.password}>
                  <PasswordInput
                    id="as-password"
                    name="password"
                    autoComplete="current-password"
                    required
                    disabled={busy || Boolean(configError)}
                    invalid={Boolean(fieldErrors.password)}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>

                <PrimaryButton
                  type="submit"
                  busy={busy}
                  busyLabel="Signing in…"
                  icon={LogIn}
                  disabled={Boolean(configError)}
                >
                  Sign in
                </PrimaryButton>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <LinkButton onClick={() => goTo(VIEWS.FORGOT)} disabled={busy}>
                    Forgot password?
                  </LinkButton>
                  <LinkButton
                    onClick={() => goTo(allowSelfSignup ? VIEWS.SIGN_UP : VIEWS.ACCESS_REQUEST)}
                    disabled={busy}
                  >
                    {allowSelfSignup ? 'Create an account' : 'Need access?'}
                  </LinkButton>
                </div>
              </form>
            )}

            {/* ---------------------------------------------------- sign up -- */}
            {activeView === VIEWS.SIGN_UP && (
              <form noValidate onSubmit={handleSignUp} className="space-y-4" aria-label="Create account">
                <Field label="Email address" icon={User} htmlFor="as-su-email" error={fieldErrors.email}
                  hint="Your verification code is sent here.">
                  <TextInput
                    id="as-su-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={busy}
                    invalid={Boolean(fieldErrors.email)}
                    placeholder="operator@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <Field label="Password" icon={Lock} htmlFor="as-su-password" error={fieldErrors.password}>
                  <PasswordInput
                    id="as-su-password"
                    name="new-password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    invalid={Boolean(fieldErrors.password)}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <PasswordRules rules={passwordCheck.rules} show />
                </Field>

                <Field
                  label="Confirm password"
                  icon={Lock}
                  htmlFor="as-su-confirm"
                  error={fieldErrors.confirmPassword}
                >
                  <PasswordInput
                    id="as-su-confirm"
                    name="confirm-password"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    invalid={Boolean(fieldErrors.confirmPassword)}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>

                <PrimaryButton type="submit" busy={busy} busyLabel="Creating account…" icon={UserPlus}>
                  Create account
                </PrimaryButton>

                <BackLink label="Back to sign in" onClick={() => goTo(VIEWS.SIGN_IN)} />
              </form>
            )}

            {/* ----------------------------------------------------- confirm -- */}
            {activeView === VIEWS.CONFIRM && (
              <form noValidate onSubmit={handleConfirm} className="space-y-4" aria-label="Confirm account">
                {/* Stated once, here. The feedback region above is never used
                    to repeat it, which is what produced duplicate banners. */}
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  We sent a 6-digit verification code to{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-200 break-all">
                    {email.trim() ? maskEmail(email.trim()) : 'your email address'}
                  </span>
                  . Enter it below to activate your account.
                </p>

                {!email.trim() && (
                  <Field label="Email address" icon={User} htmlFor="as-cf-email" error={fieldErrors.email}>
                    <TextInput
                      id="as-cf-email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={busy}
                      invalid={Boolean(fieldErrors.email)}
                      placeholder="operator@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                )}

                <Field label="Verification code" icon={ShieldCheck} htmlFor="as-cf-code" error={fieldErrors.code}>
                  <CodeInput id="as-cf-code" value={code} onChange={setCode} disabled={busy} />
                </Field>

                <PrimaryButton type="submit" busy={busy} busyLabel="Confirming…" icon={ShieldCheck}>
                  Confirm account
                </PrimaryButton>

                <div className="flex items-center justify-between gap-3">
                  <LinkButton onClick={handleResend} disabled={busy || cooldown > 0}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </LinkButton>
                  <LinkButton onClick={() => goTo(VIEWS.SIGN_IN)} disabled={busy}>
                    Back to sign in
                  </LinkButton>
                </div>
              </form>
            )}

            {/* --------------------------------------------------- challenge -- */}
            {activeView === VIEWS.CHALLENGE && (
              <form noValidate onSubmit={handleChallenge} className="space-y-4" aria-label="Complete challenge">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cognito requires <span className="font-mono font-bold">{challenge.challengeName}</span> before
                  issuing a session.
                </p>

                {challenge.challengeName === 'NEW_PASSWORD_REQUIRED' ? (
                  <Field label="New password" icon={Lock} htmlFor="as-ch-pass" error={fieldErrors.newPassword}>
                    <PasswordInput
                      id="as-ch-pass"
                      autoComplete="new-password"
                      required
                      disabled={busy}
                      invalid={Boolean(fieldErrors.newPassword)}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <PasswordRules rules={resetCheck.rules} show />
                  </Field>
                ) : (
                  <Field label="Verification code" icon={ShieldCheck} htmlFor="as-ch-code" error={fieldErrors.code}>
                    <CodeInput id="as-ch-code" value={code} onChange={setCode} disabled={busy} />
                  </Field>
                )}

                <PrimaryButton type="submit" busy={busy} busyLabel="Verifying…" icon={ShieldCheck}>
                  Continue
                </PrimaryButton>

                <BackLink
                  label="Back to sign in"
                  onClick={() => {
                    cancelChallenge();
                    goTo(VIEWS.SIGN_IN);
                  }}
                />
              </form>
            )}

            {/* ------------------------------------------------------ forgot -- */}
            {activeView === VIEWS.FORGOT && (
              <form noValidate onSubmit={handleForgot} className="space-y-4" aria-label="Request password reset">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter your email address and we'll send a code to reset your password.
                </p>

                <Field label="Email address" icon={User} htmlFor="as-fg-email" error={fieldErrors.email}>
                  <TextInput
                    id="as-fg-email"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    required
                    disabled={busy}
                    invalid={Boolean(fieldErrors.email)}
                    placeholder="operator@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>

                <PrimaryButton type="submit" busy={busy} busyLabel="Sending…" icon={MailCheck}>
                  Send reset code
                </PrimaryButton>

                <BackLink label="Back to sign in" onClick={() => goTo(VIEWS.SIGN_IN)} />
              </form>
            )}

            {/* ------------------------------------------------------- reset -- */}
            {activeView === VIEWS.RESET && (
              <form noValidate onSubmit={handleReset} className="space-y-4" aria-label="Confirm password reset">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter the code sent to{' '}
                  <span className="font-semibold text-slate-900 dark:text-slate-200 break-all">
                    {email.trim() ? maskEmail(email.trim()) : 'your email address'}
                  </span>{' '}
                  and choose a new password.
                </p>

                <Field label="Verification code" icon={ShieldCheck} htmlFor="as-rs-code" error={fieldErrors.code}>
                  <CodeInput id="as-rs-code" value={code} onChange={setCode} disabled={busy} />
                </Field>

                <Field label="New password" icon={Lock} htmlFor="as-rs-pass" error={fieldErrors.newPassword}>
                  <PasswordInput
                    id="as-rs-pass"
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    invalid={Boolean(fieldErrors.newPassword)}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <PasswordRules rules={resetCheck.rules} show />
                </Field>

                <PrimaryButton type="submit" busy={busy} busyLabel="Updating…" icon={ShieldCheck}>
                  Set new password
                </PrimaryButton>

                <div className="flex items-center justify-between gap-3">
                  <LinkButton onClick={handleForgot} disabled={busy || cooldown > 0}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </LinkButton>
                  <LinkButton onClick={() => goTo(VIEWS.SIGN_IN)} disabled={busy}>
                    Back to sign in
                  </LinkButton>
                </div>
              </form>
            )}

            {/* ---------------------------------------------- access request -- */}
            {activeView === VIEWS.ACCESS_REQUEST && (
              <div className="space-y-4" aria-label="Request access">
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-px text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Self-registration is disabled for this deployment. An administrator creates AeroSense
                    accounts in the Cognito user pool and you receive an email with a temporary password.
                  </p>
                </div>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">To request an account:</p>
                  <ol className="list-decimal list-inside space-y-1 marker:text-slate-400">
                    <li>Contact your AeroSense administrator with your work email.</li>
                    <li>They provision the account and you receive a temporary password.</li>
                    <li>Sign in; you will be asked to set a permanent password.</li>
                  </ol>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
                  <MailQuestion className="w-4 h-4 shrink-0 text-indigo-500" aria-hidden="true" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Already have an account but never confirmed it?{' '}
                    <LinkButton onClick={() => goTo(VIEWS.CONFIRM)}>Enter your code</LinkButton>
                  </p>
                </div>

                <BackLink label="Back to sign in" onClick={() => goTo(VIEWS.SIGN_IN)} />
              </div>
            )}
          </div>

          <footer className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
              Credentials are exchanged with AWS Cognito through the AeroSense auth service.
              No client secret is held in this browser.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

function BackLink({ label, onClick }) {
  return (
    <div className="flex justify-center pt-0.5">
      <LinkButton onClick={onClick} className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
        <ArrowLeft className="w-3 h-3" aria-hidden="true" />
        <span>{label}</span>
      </LinkButton>
    </div>
  );
}
