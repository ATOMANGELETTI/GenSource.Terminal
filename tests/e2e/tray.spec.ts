import { test, expect } from '@playwright/test';

import { expectScreenshot, openApp } from './helpers/app';

test.describe('tray', () => {
  test('tray menu window', async ({ page }) => {
    await openApp(page, { window: 'tray-menu', e2e: true });
    await expect(page.locator('.tray-context-menu')).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: /Quit GenSource Terminal/ }),
    ).toBeVisible();
    await expectScreenshot(page, 'tray-menu');
  });
});
