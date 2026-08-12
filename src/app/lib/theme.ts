export type ConcreteTheme =
  | "nord-polar-night"
  | "nord-snow-storm"
  | "nord-frost"
  | "nord-frost-light"
  | "nord-aurora"
  | "nord-aurora-light";

const DEFAULT_THEME: ConcreteTheme = "nord-polar-night";

/** Fixed theme ids / aliases that never follow the OS scheme. */
const FIXED_THEMES: Record<string, ConcreteTheme> = {
  "nord-polar-night": "nord-polar-night",
  "polar-night": "nord-polar-night",
  "nord-snow-storm": "nord-snow-storm",
  "snow-storm": "nord-snow-storm",
  "nord-frost-light": "nord-frost-light",
  "frost-light": "nord-frost-light",
  "nord-frost-dark": "nord-frost",
  "frost-dark": "nord-frost",
  "nord-aurora-light": "nord-aurora-light",
  "aurora-light": "nord-aurora-light",
  "nord-aurora-dark": "nord-aurora",
  "aurora-dark": "nord-aurora",
};

/** Preferences that resolve to a light or dark concrete theme from the OS. */
const OS_AWARE_PREFERENCES = new Set([
  "system",
  "frost",
  "nord-frost",
  "aurora",
  "nord-aurora",
]);

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * True when the preference should re-resolve whenever the OS light/dark
 * scheme changes (`system`, `frost`/`nord-frost`, `aurora`/`nord-aurora`).
 */
export function followsSystemScheme(preference: string): boolean {
  return OS_AWARE_PREFERENCES.has(preference.trim().toLowerCase());
}

/**
 * Resolves a `settings.json` theme preference to a concrete, CSS-selectable
 * theme id.
 *
 * - `system` → polar-night (dark) or snow-storm (light)
 * - `frost` / `nord-frost` → nord-frost or nord-frost-light
 * - `aurora` / `nord-aurora` → nord-aurora or nord-aurora-light
 * - `frost-dark` / `frost-light` (and aurora equivalents) lock the variant
 * - polar-night / snow-storm stay fixed
 */
export function resolveTheme(preference: string): ConcreteTheme {
  const key = preference.trim().toLowerCase();

  if (key === "system") {
    return isSystemDark() ? "nord-polar-night" : "nord-snow-storm";
  }

  if (key === "frost" || key === "nord-frost") {
    return isSystemDark() ? "nord-frost" : "nord-frost-light";
  }

  if (key === "aurora" || key === "nord-aurora") {
    return isSystemDark() ? "nord-aurora" : "nord-aurora-light";
  }

  return FIXED_THEMES[key] ?? DEFAULT_THEME;
}

export function isSystemDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return true;
  }
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

/**
 * Subscribes to OS light/dark preference changes. Returns an unsubscribe
 * function. Callers should gate on `followsSystemScheme` before re-applying.
 */
export function watchSystemThemeChange(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mql = window.matchMedia(SYSTEM_DARK_QUERY);
  const listener = () => onChange();

  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }

  // Safari < 14 fallback.
  mql.addListener(listener);
  return () => mql.removeListener(listener);
}
