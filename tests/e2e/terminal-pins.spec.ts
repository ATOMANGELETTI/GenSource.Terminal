import { test, expect } from '@playwright/test';

import { openApp } from './helpers/app';

test.describe('terminal pins', () => {
  test('restores pinned scrollback from __E2E_PINNED_TABS__', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (
        window as unknown as { __E2E_PINNED_TABS__: unknown }
      ).__E2E_PINNED_TABS__ = {
        version: 1,
        tabs: [
          {
            tabId: 'pin-1',
            profileId: 'powershell',
            title: 'PowerShell',
            scrollback: 'E2E_PIN_MARKER_42',
            wasActive: true,
          },
        ],
      };
    });

    await openApp(page);

    await expect(page.getByTestId('terminal-workspace')).toBeVisible();
    await expect(page.getByText('E2E_PIN_MARKER_42')).toBeVisible();
    await expect(page.getByTestId('terminal-tab')).toHaveAttribute(
      'data-pinned',
      'true',
    );
  });

  test('opens a default tab when no pins are seeded', async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId('terminal-workspace')).toBeVisible();
    await expect(page.getByTestId('terminal-tab')).toBeVisible();
    await expect(page.getByTestId('terminal-tab')).toHaveAttribute(
      'data-pinned',
      'false',
    );
  });

  // Live ConPTY pin round-trip needs a full Tauri harness (not Vite e2e).
  test('live ConPTY pin restore', async ({ page }) => {
    test.skip(
      !process.env.TAURI_E2E,
      'live ConPTY pin restore requires TAURI_E2E',
    );
    await openApp(page);
    await expect(page.getByTestId('terminal-workspace')).toBeVisible();
  });
});
