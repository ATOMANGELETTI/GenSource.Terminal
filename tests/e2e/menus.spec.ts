import { test, expect } from '@playwright/test';

import {
  expectScreenshot,
  openApp,
  openContentMenu,
  openTitlebarMenu,
} from './helpers/app';

test.describe('menus', () => {
  // Vite e2e has no Tauri popup window, so titlebar/content menus fall back
  // to in-webview overlays (see openContextMenuPopup / canUseContextMenuPopup).
  test('titlebar context menu', async ({ page }) => {
    await openApp(page);
    await openTitlebarMenu(page);
    await expect(page.locator('.titlebar-context-menu')).toBeVisible();
    await expectScreenshot(page, 'menu-titlebar');
  });

  test('content area context menu', async ({ page }) => {
    await openApp(page);
    await openContentMenu(page);
    await expect(page.locator('.content-context-menu')).toBeVisible();
    await expectScreenshot(page, 'menu-content');
  });
});
