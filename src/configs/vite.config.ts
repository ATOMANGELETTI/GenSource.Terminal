import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { devServerMiddleware } from './middleware.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  root: repoRoot,
  envDir: repoRoot,
  clearScreen: false,
  plugins: [react(), tailwindcss(), devServerMiddleware()],
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'src/app'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Windows can EBUSY-lock TTFs once another process touches them; fonts
      // don't need HMR, so skip watching public/fonts.
      ignored: [
        '**/src-tauri/**',
        '**/public/fonts/**',
        '**/tests/artifacts/**',
      ],
    },
  },
});
