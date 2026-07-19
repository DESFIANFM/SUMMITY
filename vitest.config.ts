import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Standalone test config. We intentionally do NOT reuse vite.config.ts so the
// PWA plugin, Tailwind, and dev-server options don't slow down or interfere
// with the test run. Only the React plugin and the `@` path alias are shared.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // jsdom gives us window/document/localStorage/navigator for component &
    // browser-dependent unit tests.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // db.ts registers a setInterval on import; restore timers/mocks between tests.
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/context/**', 'src/components/ProtectedRoute.tsx'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    },
  },
});
