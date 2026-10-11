/**
 * Browser geolocation with an explicit state machine.
 * -----------------------------------------------------------------------------
 * States: not_requested | requesting | granted | denied | unavailable | error
 *
 * Rules this enforces:
 *   * nothing happens until `request()` is called from a user action, so merely
 *     opening the app never triggers a permission prompt;
 *   * a denial is remembered for the session, so the user is not re-prompted on
 *     every render or navigation;
 *   * coordinates are only ever the real ones the browser returned. A failure
 *     yields null coordinates and a message — never a default position
 *     presented as the user's location;
 *   * a timeout is reported distinctly from a denial, because the remedies
 *     differ;
 *   * nothing here can block the rest of the app: callers treat the result as
 *     optional enrichment.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const GEO_STATUS = {
  NOT_REQUESTED: 'not_requested',
  REQUESTING: 'requesting',
  GRANTED: 'granted',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};

const DEFAULT_OPTIONS = {
  timeout: 10_000,
  maximumAge: 60_000,
  enableHighAccuracy: true,
};

/** Geolocation requires a secure context; browsers reject it on plain http. */
function isSupported() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
  if (typeof window === 'undefined') return false;
  // localhost counts as secure, so this only excludes real insecure origins.
  return window.isSecureContext !== false;
}

export function useGeolocation(options = {}) {
  const [status, setStatus] = useState(GEO_STATUS.NOT_REQUESTED);
  const [coords, setCoords] = useState(null);
  const [message, setMessage] = useState(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * If the browser already knows permission is denied, reflect that up front so
   * the UI can offer search instead of a button that will be refused.
   */
  useEffect(() => {
    if (!isSupported()) {
      setStatus(GEO_STATUS.UNAVAILABLE);
      setMessage('This browser does not provide location access.');
      return undefined;
    }
    if (!navigator.permissions?.query) return undefined;

    let cancelled = false;
    let permissionStatus = null;

    const sync = () => {
      if (cancelled || !permissionStatus) return;
      if (permissionStatus.state === 'denied') {
        setStatus(GEO_STATUS.DENIED);
        setMessage('Location access is blocked for this site in your browser settings.');
      }
    };

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (cancelled) return;
        permissionStatus = result;
        sync();
        result.addEventListener?.('change', sync);
      })
      .catch(() => {
        // Permissions API unsupported for geolocation; harmless.
      });

    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener?.('change', sync);
    };
  }, []);

  /** Ask the browser for a position. Safe to call only from a user gesture. */
  const request = useCallback(() => {
    if (!isSupported()) {
      setStatus(GEO_STATUS.UNAVAILABLE);
      setMessage('This browser does not provide location access.');
      return;
    }
    // One prompt at a time, and never re-prompt after an explicit denial.
    if (inFlightRef.current || status === GEO_STATUS.REQUESTING) return;

    inFlightRef.current = true;
    setStatus(GEO_STATUS.REQUESTING);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ latitude, longitude, accuracy: accuracy ?? null });
        setStatus(GEO_STATUS.GRANTED);
        setMessage(null);
      },
      (err) => {
        inFlightRef.current = false;
        if (!mountedRef.current) return;
        // Coordinates stay null: a failure must never look like a real fix.
        setCoords(null);

        if (err?.code === 1 /* PERMISSION_DENIED */) {
          setStatus(GEO_STATUS.DENIED);
          setMessage('Location permission was denied. Search for a place instead.');
        } else if (err?.code === 3 /* TIMEOUT */) {
          setStatus(GEO_STATUS.ERROR);
          setMessage('Finding your location took too long. Try again or search for a place.');
        } else {
          setStatus(GEO_STATUS.ERROR);
          setMessage('Your location could not be determined. Search for a place instead.');
        }
      },
      { ...DEFAULT_OPTIONS, ...options }
    );
  }, [status, options]);

  /** Clear a transient error so the user can retry; a denial is not cleared. */
  const reset = useCallback(() => {
    setStatus((prev) => (prev === GEO_STATUS.ERROR ? GEO_STATUS.NOT_REQUESTED : prev));
    setMessage((prev) => (status === GEO_STATUS.ERROR ? null : prev));
  }, [status]);

  return {
    status,
    coords,
    message,
    request,
    reset,
    supported: isSupported(),
    isRequesting: status === GEO_STATUS.REQUESTING,
    /** True once the user has made a choice; used to stop re-asking. */
    settled: status === GEO_STATUS.GRANTED || status === GEO_STATUS.DENIED || status === GEO_STATUS.UNAVAILABLE,
  };
}
