import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: process.env.API_TESTS ? ['*.api.test.ts'] : ['*.smoke.test.ts'],
    testTimeout: 45_000,
  },
});
