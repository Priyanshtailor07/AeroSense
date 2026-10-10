import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/* jsdom gaps that the app legitimately relies on in a browser. */

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// The dashboard's sound effects construct a WebAudio graph on demand.
if (!window.AudioContext) {
  const node = () => ({
    connect: () => node(),
    disconnect: () => {},
    start: () => {},
    stop: () => {},
    frequency: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
    gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    type: 'sine',
  });
  window.AudioContext = class {
    constructor() {
      this.currentTime = 0;
      this.destination = node();
      this.state = 'running';
    }
    createOscillator() { return node(); }
    createGain() { return node(); }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  };
  window.webkitAudioContext = window.AudioContext;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // ignore
  }
});
