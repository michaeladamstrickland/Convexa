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
      'tests/unit/**/*.test.ts',
      'tests/contract/**/*.test.ts',
      'tests/snapshot/**/*.test.ts',
    ],
    exclude: [
      'tests/dev/**',
      'tests/e2e/**',
      'tests/**/jest/**',
    ],
  },
});
