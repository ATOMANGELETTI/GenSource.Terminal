import { test, expect } from '@playwright/test';

import { expectScreenshot, openApp } from './helpers/app';

test.describe('splash', () => {
  test('frozen splash window', async ({ page }) => {
    await openApp(page, { window: 'splash', e2e: true });
    await expect(page.locator('.splash')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Loading' })).toBeVisible();
    await expectScreenshot(page, 'splash-frozen');
  });
});
