import { test, expect } from '@playwright/test';

import { expectScreenshot, openApp } from './helpers/app';

test.describe('shell', () => {
  test('renders titlebar and terminal workspace', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.titlebar')).toBeVisible();
    await expect(page.getByTestId('terminal-workspace')).toBeVisible();
    await expect(page.getByTestId('tab-bar')).toBeVisible();
    await expectScreenshot(page, 'shell-default');
  });
});
