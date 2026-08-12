import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'src/app'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    pool: 'threads',
    fileParallelism: false,
  },
});
