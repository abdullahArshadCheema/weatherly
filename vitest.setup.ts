import { expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import 'whatwg-fetch';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Auto-cleanup DOM between tests
afterEach(() => {
  cleanup();
});

// Basic geolocation mock; individual tests can override behavior
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback) => {
      // default: permission denied to force explicit control in tests
      error && error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    },
  },
  configurable: true,
});
