// Runs once before every test file (configured via vitest.config.ts setupFiles).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Ensure each test starts from a clean DOM and clean browser storage so tests
// never leak state into one another.
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom does not implement crypto.randomUUID in older versions; provide a
// deterministic-enough polyfill so db.ts helpers work under test.
beforeEach(() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    // @ts-expect-error - augmenting the test environment only
    crypto.randomUUID = () =>
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === '0' ? r : (c === '1' ? (r & 0x3) | 0x8 : 4);
        return v.toString(16);
      });
  }
});
