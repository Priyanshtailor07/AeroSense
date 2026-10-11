/**
 * Geolocation state machine: granted, denied, unavailable and timed out.
 *
 * The invariant throughout: a failure yields NO coordinates. The app must never
 * present a default position as the user's location, and must never be blocked
 * by a refusal.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGeolocation, GEO_STATUS } from './useGeolocation';

const POSITION = { coords: { latitude: 19.076, longitude: 72.8777, accuracy: 25 } };

let getCurrentPosition;

/**
 * Patch properties on the real window/navigator rather than replacing them:
 * React and jsdom need the genuine objects, so vi.stubGlobal('window', ...)
 * breaks rendering outright.
 */
function define(target, prop, value) {
  Object.defineProperty(target, prop, { value, configurable: true, writable: true });
}

function installGeolocation({ permissionState = 'prompt', geolocation = true, secure = true } = {}) {
  getCurrentPosition = vi.fn();
  define(
    window.navigator,
    'geolocation',
    geolocation ? { getCurrentPosition } : undefined
  );
  define(window.navigator, 'permissions', {
    query: vi.fn().mockResolvedValue({
      state: permissionState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  define(window, 'isSecureContext', secure);
}

beforeEach(() => {
  installGeolocation();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initial state', () => {
  it('starts not_requested and prompts nobody on mount', () => {
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe(GEO_STATUS.NOT_REQUESTED);
    expect(result.current.coords).toBeNull();
    // Nothing is asked until a user action calls request().
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('granted', () => {
  it('reports the real coordinates the browser returned', async () => {
    getCurrentPosition.mockImplementation((success) => success(POSITION));
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.GRANTED));
    expect(result.current.coords).toEqual({ latitude: 19.076, longitude: 72.8777, accuracy: 25 });
    expect(result.current.message).toBeNull();
  });
});

describe('denied', () => {
  it('records the denial and keeps coordinates null', async () => {
    getCurrentPosition.mockImplementation((_s, error) => error({ code: 1 }));
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.DENIED));
    // No substitute position may stand in for a real fix.
    expect(result.current.coords).toBeNull();
    expect(result.current.message).toMatch(/denied/i);
    expect(result.current.message).toMatch(/search/i);
  });

  it('does not re-prompt after a denial', async () => {
    getCurrentPosition.mockImplementation((_s, error) => error({ code: 1 }));
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.DENIED));

    act(() => result.current.reset());
    expect(result.current.status).toBe(GEO_STATUS.DENIED);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('reflects a pre-existing browser denial without prompting', async () => {
    installGeolocation({ permissionState: 'denied' });
    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.DENIED));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('timeout and failure', () => {
  it('reports a timeout distinctly from a denial', async () => {
    getCurrentPosition.mockImplementation((_s, error) => error({ code: 3 }));
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());

    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.ERROR));
    expect(result.current.message).toMatch(/too long/i);
    expect(result.current.coords).toBeNull();
  });

  it('allows a retry after a transient error', async () => {
    getCurrentPosition.mockImplementation((_s, error) => error({ code: 2 }));
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.ERROR));

    act(() => result.current.reset());
    expect(result.current.status).toBe(GEO_STATUS.NOT_REQUESTED);

    getCurrentPosition.mockImplementation((success) => success(POSITION));
    act(() => result.current.request());
    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.GRANTED));
  });
});

describe('unavailable', () => {
  it('reports unavailable when the browser has no geolocation', async () => {
    installGeolocation({ geolocation: false });
    const { result } = renderHook(() => useGeolocation());

    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.UNAVAILABLE));
    expect(result.current.supported).toBe(false);

    act(() => result.current.request());
    expect(result.current.coords).toBeNull();
  });

  it('reports unavailable outside a secure context', async () => {
    installGeolocation({ secure: false });
    const { result } = renderHook(() => useGeolocation());
    await waitFor(() => expect(result.current.status).toBe(GEO_STATUS.UNAVAILABLE));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('concurrency', () => {
  it('does not fire a second prompt while one is pending', async () => {
    getCurrentPosition.mockImplementation(() => {}); // never resolves
    const { result } = renderHook(() => useGeolocation());

    act(() => result.current.request());
    act(() => result.current.request());
    act(() => result.current.request());

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe(GEO_STATUS.REQUESTING);
  });
});
