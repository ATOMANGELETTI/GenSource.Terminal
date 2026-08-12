import { test } from '@playwright/test';

import { applyVisualSettings, expectScreenshot, openApp } from './helpers/app';

const FONTS = [
  'Terminus',
  'Ubuntu',
  'Fira Code',
  'Plus Jakarta Sans',
] as const;

test.describe('fonts', () => {
  for (const fontFamily of FONTS) {
    test(`shell uses ${fontFamily}`, async ({ page }) => {
      await openApp(page);
      await applyVisualSettings(page, {
        theme: 'nord-polar-night',
        fontFamily,
      });
      await expectScreenshot(page, `font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`);
    });
  }
});
