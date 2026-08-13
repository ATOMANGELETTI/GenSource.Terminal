import { expect, type Page } from '@playwright/test';

export type VisualWindow = 'main' | 'splash' | 'tray-menu' | 'context-menu';

/** Mirrors `FONT_FAMILY_MAP` in src/app/lib/settings.ts for DOM fixtures. */
const FONT_STACKS: Record<string, string> = {
  Terminus: 'Terminus, ui-monospace, monospace',
  Ubuntu: 'Ubuntu, ui-sans-serif, system-ui, sans-serif',
  'Fira Code': '"Fira Code", ui-monospace, monospace',
  'Plus Jakarta Sans':
    '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
};

export interface OpenAppOptions {
  window?: VisualWindow;
  e2e?: boolean;
}

export async function openApp(
  page: Page,
  options: OpenAppOptions = {},
): Promise<void> {
  const params = new URLSearchParams();
  if (options.window && options.window !== 'main') {
    params.set('window', options.window);
  }
  if (options.e2e !== false) {
    params.set('e2e', '1');
  }
  const query = params.toString();
  await page.goto(query ? `/?${query}` : '/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });

  const windowLabel = options.window ?? 'main';
  if (windowLabel === 'main') {
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      'nord-polar-night',
      { timeout: 10_000 },
    );
  } else if (windowLabel === 'splash') {
    await expect(page.locator('.splash')).toBeVisible({ timeout: 10_000 });
  } else if (windowLabel === 'tray-menu') {
    await expect(page.locator('.tray-context-menu')).toBeVisible({
      timeout: 10_000,
    });
    // Version appears once e2e stub (or backend) loads app info.
    await expect(page.locator('.context-menu__header-version')).toBeVisible({
      timeout: 10_000,
    });
  } else if (windowLabel === 'context-menu') {
    // Popup host mounts empty until a `context-menu-open` event; in Vite e2e
    // the shell is still present for screenshot/theme fixtures.
    await expect(page.locator('.context-menu-window')).toBeVisible({
      timeout: 10_000,
    });
  }
}

export async function applyVisualSettings(
  page: Page,
  settings: { theme: string; fontFamily?: string; fontSize?: number },
): Promise<void> {
  const fontFamily = settings.fontFamily ?? 'Terminus';
  const stack = FONT_STACKS[fontFamily] ?? `"${fontFamily}", Terminus, ui-monospace, monospace`;
  const fontSize = settings.fontSize ?? 14;

  await page.evaluate(
    ({ theme, stack, fontSize }) => {
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.style.setProperty('--font-sans', stack);
      root.style.fontSize = `${fontSize}px`;
    },
    { theme: settings.theme, stack, fontSize },
  );
}

export async function expectScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
  });
}

export async function openTitlebarMenu(page: Page): Promise<void> {
  await page.locator('.titlebar').click({ button: 'right', position: { x: 200, y: 16 } });
  await expect(page.getByRole('menu')).toBeVisible();
}

export async function openContentMenu(page: Page): Promise<void> {
  await page.locator('.app-shell__main').click({
    button: 'right',
    position: { x: 240, y: 120 },
  });
  await expect(page.getByRole('menu')).toBeVisible();
}
