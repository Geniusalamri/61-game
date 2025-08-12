import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.{test,spec}.{ts,tsx}', '!packages/**/dist/**'],
    coverage: {
      // Vitest 0.35+ dropped support for the c8 provider.  Use the native v8 provider instead.
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});