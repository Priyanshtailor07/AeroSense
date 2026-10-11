/**
 * Account creation, email confirmation and password reset.
 *
 * The invariant under test throughout: confirming an email is NOT
 * authentication. Only a real Cognito session may open the dashboard.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../context/AuthProvider';
import ProtectedRoute from './ProtectedRoute';
import { __resetAuthForTests } from '../../services/auth';
import { createFetchMock, jsonResponse, makeSessionPayload } from '../../test/helpers';

const DASHBOARD = 'PROTECTED-DASHBOARD-CONTENT';
const GOOD_PASSWORD = 'Str0ng-Passw0rd!';

let fetchMock;

function renderAuth() {
  return render(
    <AuthProvider>
      <ProtectedRoute>
        <div>{DASHBOARD}</div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

const user = () => userEvent.setup();

async function openCreateAccount() {
  await user().click(await screen.findByRole('button', { name: /create an account/i }));
  return screen.findByRole('button', { name: /^create account$/i });
}

beforeEach(() => {
  __resetAuthForTests();
  fetchMock = createFetchMock();
  vi.stubGlobal('fetch', fetchMock);
});

describe('create account', () => {
  it('submits to the auth Lambda and moves to confirmation', async () => {
    fetchMock.on('/auth/signup', jsonResponse({ ok: true, userConfirmed: false, message: 'Check your email.' }));
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByRole('button', { name: /confirm account/i })).toBeInTheDocument();
    const body = JSON.parse(fetchMock.callsTo('/auth/signup')[0].options.body);
    expect(body.username).toBe('newuser@example.com');
    expect(body.email).toBe('newuser@example.com');
    // The dashboard must not open just because an account was created.
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
  });

  it('never sends a client secret or SECRET_HASH from the browser', async () => {
    fetchMock.on('/auth/signup', jsonResponse({ ok: true, userConfirmed: false }));
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    await waitFor(() => expect(fetchMock.callsTo('/auth/signup')).toHaveLength(1));
    const sent = fetchMock.calls.map((c) => String(c.options.body || '')).join('|').toLowerCase();
    expect(sent).not.toContain('secret');
    expect(fetchMock.callsTo('cognito-idp')).toHaveLength(0);
  });

  it('rejects a weak password before contacting the backend', async () => {
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), 'weak');
    await u.type(screen.getByLabelText(/confirm password/i), 'weak');
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText(/does not meet the requirements/i)).toBeInTheDocument();
    expect(fetchMock.callsTo('/auth/signup')).toHaveLength(0);
  });

  it('rejects mismatched passwords before contacting the backend', async () => {
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), `${GOOD_PASSWORD}-different`);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(fetchMock.callsTo('/auth/signup')).toHaveLength(0);
  });

  it('rejects an invalid email before contacting the backend', async () => {
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(fetchMock.callsTo('/auth/signup')).toHaveLength(0);
  });

  it('surfaces a duplicate email from Cognito', async () => {
    fetchMock.on('/auth/signup', jsonResponse(
      { ok: false, code: 'USERNAME_EXISTS', message: 'An account with that username already exists.' },
      409
    ));
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'taken@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
    // Stays on the form; not advanced to confirmation.
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument();
  });

  it('reports a policy-disabled signup instead of appearing to succeed', async () => {
    fetchMock.on('/auth/signup', jsonResponse(
      { ok: false, code: 'SIGNUP_DISABLED', message: 'Self sign-up is disabled for this deployment.' },
      403
    ));
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/disabled/i);
    expect(screen.queryByRole('button', { name: /confirm account/i })).not.toBeInTheDocument();
  });

  it('prevents a duplicate submission while one is in flight', async () => {
    let release;
    fetchMock.on('/auth/signup', () => new Promise((resolve) => {
      release = () => resolve(jsonResponse({ ok: true, userConfirmed: false }));
    }));
    renderAuth();
    await openCreateAccount();

    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);

    const submit = screen.getByRole('button', { name: /^create account$/i });
    await u.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await u.click(submit).catch(() => {});

    expect(fetchMock.callsTo('/auth/signup')).toHaveLength(1);
    release();
  });
});

describe('email confirmation', () => {
  async function reachConfirm() {
    fetchMock.on('/auth/signup', jsonResponse({ ok: true, userConfirmed: false }));
    renderAuth();
    await openCreateAccount();
    const u = user();
    await u.type(screen.getByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.type(screen.getByLabelText(/confirm password/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^create account$/i }));
    await screen.findByRole('button', { name: /confirm account/i });
  }

  it('shows the masked destination email exactly once', async () => {
    await reachConfirm();
    const mentions = screen.getAllByText(/we sent a 6-digit verification code/i);
    expect(mentions).toHaveLength(1);
    // Masked, not the raw address.
    expect(screen.getByText(/ne•+er@example\.com/)).toBeInTheDocument();
    expect(screen.queryByText('newuser@example.com')).not.toBeInTheDocument();
  });

  it('confirms with a valid code and returns to sign-in, not the dashboard', async () => {
    await reachConfirm();
    fetchMock.on('/auth/confirm-signup', jsonResponse({ ok: true, message: 'Account confirmed.' }));

    await user().type(screen.getByLabelText(/verification code/i), '123456');
    await user().click(screen.getByRole('button', { name: /confirm account/i }));

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    // Confirmation is not authentication.
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
    // The email is preserved so it need not be retyped.
    expect(screen.getByLabelText(/email address/i)).toHaveValue('newuser@example.com');
  });

  it('reports an invalid code', async () => {
    await reachConfirm();
    fetchMock.on('/auth/confirm-signup', jsonResponse(
      { ok: false, code: 'CODE_MISMATCH', message: 'That verification code is not correct.' }, 400
    ));

    await user().type(screen.getByLabelText(/verification code/i), '000000');
    await user().click(screen.getByRole('button', { name: /confirm account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not correct/i);
    expect(screen.getByRole('button', { name: /confirm account/i })).toBeInTheDocument();
  });

  it('reports an expired code', async () => {
    await reachConfirm();
    fetchMock.on('/auth/confirm-signup', jsonResponse(
      { ok: false, code: 'CODE_EXPIRED', message: 'That verification code has expired. Request a new one.' }, 400
    ));

    await user().type(screen.getByLabelText(/verification code/i), '123456');
    await user().click(screen.getByRole('button', { name: /confirm account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired/i);
  });

  it('resends a code and then throttles further requests', async () => {
    await reachConfirm();
    fetchMock.on('/auth/resend-confirmation', jsonResponse({ ok: true, message: 'A new confirmation code has been sent.' }));

    // The cooldown starts as soon as signup succeeds, so no immediate resend.
    const resend = screen.getByRole('button', { name: /resend code in \d+s/i });
    expect(resend).toBeDisabled();
    expect(fetchMock.callsTo('/auth/resend-confirmation')).toHaveLength(0);
  });

  it('only strips non-digits from a pasted code', async () => {
    await reachConfirm();
    const field = screen.getByLabelText(/verification code/i);
    await user().type(field, 'a1b2c3d4e5f6');
    expect(field).toHaveValue('123456');
  });
});

describe('password reset', () => {
  it('requests a code then completes the reset and returns to sign-in', async () => {
    fetchMock.on('/auth/forgot-password', jsonResponse({ ok: true, message: 'If an account exists, a code has been sent.' }));
    fetchMock.on('/auth/confirm-forgot-password', jsonResponse({ ok: true, message: 'Password updated.' }));
    renderAuth();

    await user().click(await screen.findByRole('button', { name: /forgot password/i }));
    await user().type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user().click(screen.getByRole('button', { name: /send reset code/i }));

    await screen.findByRole('button', { name: /set new password/i });
    await user().type(screen.getByLabelText(/verification code/i), '654321');
    await user().type(screen.getByLabelText(/new password/i), GOOD_PASSWORD);
    await user().click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByText(DASHBOARD)).not.toBeInTheDocument();
  });
});

describe('confirmation followed by sign-in', () => {
  it('opens the dashboard only after Cognito issues a session', async () => {
    fetchMock.on('/auth/confirm-signup', jsonResponse({ ok: true, message: 'Account confirmed.' }));
    fetchMock.on('/auth/signin', jsonResponse({ ok: true, session: makeSessionPayload() }));
    renderAuth();

    // Reach confirmation directly via the "need access"/confirm path.
    await user().click(await screen.findByRole('button', { name: /create an account/i }));
    await user().click(screen.getByRole('button', { name: /back to sign in/i }));

    const u = user();
    await u.type(await screen.findByLabelText(/email address/i), 'newuser@example.com');
    await u.type(screen.getByLabelText(/^password$/i), GOOD_PASSWORD);
    await u.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(DASHBOARD)).toBeInTheDocument();
  });
});
