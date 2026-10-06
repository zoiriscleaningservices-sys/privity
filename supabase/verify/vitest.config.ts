import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // One embedded PostgreSQL server; each test file gets its own database cloned from a
    // migrated template. Files run sequentially (CREATE DATABASE … TEMPLATE needs an idle
    // template); concurrency is exercised INSIDE tests with real parallel connections.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
