import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/** Dedicated port so Playwright does not collide with `tauri:dev` on 1420. */
const E2E_PORT = 1421;
const E2E_ORIGIN = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: path.resolve(repoRoot, 'tests/e2e'),
  outputDir: path.resolve(repoRoot, 'tests/artifacts/playwright-results'),
  snapshotPathTemplate: path.resolve(
    repoRoot,
    'tests/e2e/baselines/{testFilePath}/{arg}{ext}',
  ),
  reporter: [
    [
      'html',
      { outputFolder: path.resolve(repoRoot, 'tests/artifacts/playwright-report') },
    ],
  ],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT}`,
    url: E2E_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
