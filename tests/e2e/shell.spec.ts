import { test, expect } from '@playwright/test';

import { expectScreenshot, openApp } from './helpers/app';

test.describe('shell', () => {
  test('renders titlebar and main content', async ({ page }) => {
    await openApp(page);
    await expect(
      page.getByRole('heading', { name: 'GenSource Template' }).first(),
    ).toBeVisible();
    await expect(page.locator('.titlebar')).toBeVisible();
    await expectScreenshot(page, 'shell-default');
  });
});
