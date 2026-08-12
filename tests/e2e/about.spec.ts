import { test, expect } from '@playwright/test';

import { expectScreenshot, openApp, openContentMenu } from './helpers/app';

test.describe('about', () => {
  test('about dialog from content menu', async ({ page }) => {
    await openApp(page);
    await openContentMenu(page);
    await page.getByRole('menuitem', { name: /About GenSource Terminal/ }).click();
    await expect(page.getByRole('dialog', { name: /About GenSource Terminal/ })).toBeVisible();
    await expectScreenshot(page, 'about-dialog');
  });
});
