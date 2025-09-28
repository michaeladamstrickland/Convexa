import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'backend/**/*.ts'],
      exclude: ['**/*.d.ts'],
    },
    include: [
      'tests/unit/**/*.{test,spec}.ts',
      'tests/contract/**/*.{test,spec}.ts',
      'tests/snapshot/**/*.{test,spec}.ts',
      'tests/routes/**/*.{test,spec}.ts',
    ],
    exclude: [
      'tests/dev/**',
      'tests/e2e/**',
      'tests/**/jest/**',
    ],
  },
});
