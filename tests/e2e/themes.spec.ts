import { test } from '@playwright/test';

import { applyVisualSettings, expectScreenshot, openApp } from './helpers/app';

const THEMES = [
  'nord-polar-night',
  'nord-snow-storm',
  'nord-frost',
  'nord-frost-light',
  'nord-aurora',
  'nord-aurora-light',
] as const;

test.describe('themes', () => {
  for (const theme of THEMES) {
    test(`shell looks correct under ${theme}`, async ({ page }) => {
      await openApp(page);
      await applyVisualSettings(page, { theme });
      await expectScreenshot(page, `theme-${theme}`);
    });
  }
});
