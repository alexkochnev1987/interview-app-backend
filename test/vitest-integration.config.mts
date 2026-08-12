import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.integration.spec.ts'],
    setupFiles: ['./test/integration-env.ts'],
    globalSetup: ['./test/integration-global-setup.ts'],
    testTimeout: 60000,
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        transform: {
          useDefineForClassFields: false,
        },
      },
    }),
  ],
});
