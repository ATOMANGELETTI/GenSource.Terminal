---
name: tester-pro
description: Use when asked to run the project test suite, fill missing Vitest/Playwright coverage, refresh visual baselines intentionally, or when the /tester-pro slash command is invoked.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Tester Pro

Run-first test orchestrator for this template. Prefer fixing or adding
**only** what fails or is missing — never mass-rewrite passing specs.

## Instructions

1. **Read the registry.** Open [`tests/surfaces.json`](../../../tests/surfaces.json).
   Note each surface `path` and whether it is `unit` or `e2e` (`visual: true`
   means Playwright screenshots under `tests/e2e/baselines/`).
2. **Inventory.** List existing files under `tests/unit/` and `tests/e2e/`
   (ignore `tests/e2e/helpers/` and `tests/e2e/baselines/`). Diff against the
   registry: any missing `path` is a **gap**.
3. **Run first.**
   - `npm test` (Vitest → `tests/unit/`)
   - `npm run test:e2e` (Playwright on port **1421**; artifacts in
     `tests/artifacts/`)
4. **Stop if green and complete.** If every registry path exists and both
   commands pass, report success (command output + any report paths under
   `tests/artifacts/`). Do **not** regenerate baselines or rewrite specs.
5. **Fill gaps / fix failures only.**
   - Missing unit surface → add a focused `tests/unit/*.test.ts`.
   - Missing e2e/visual surface → add a `tests/e2e/*.spec.ts` using helpers in
     `tests/e2e/helpers/app.ts` (`openApp`, `applyVisualSettings`,
     `expectScreenshot`, menu helpers). Use `?window=splash|tray-menu` and
     `e2e=1` for secondary windows (see `src/app/lib/e2e-window.ts`).
   - Failing assertion → fix the **smallest** app or test change that restores
     the intended behavior.
   - **Baselines:** run `npm run test:e2e:update` only when (a) a new visual
     spec has no PNG yet, or (b) the user explicitly asked to refresh
     snapshots after an intentional UI change. Never update baselines just to
     make a regression “pass.”
6. **Re-run affected suites** (`npm test` and/or `npm run test:e2e`). Summarize
   remaining failures with paths under `tests/artifacts/`.
7. **Keep the registry honest.** When you add a lasting surface, append it to
   `tests/surfaces.json`.

## Layout (do not invent parallel trees)

| Path | Purpose |
| --- | --- |
| `tests/unit/` | Vitest |
| `tests/e2e/` | Playwright specs |
| `tests/e2e/baselines/` | **Committed** screenshot baselines |
| `tests/artifacts/` | **Gitignored** reports, traces, failure dumps |
| `src/configs/playwright.config.ts` | Playwright config (port 1421) |
| `src/configs/vitest.config.ts` | Vitest config |

## Red flags — stop

- Rewriting all specs because “coverage might be stale”
- Running `test:e2e:update` without a missing baseline or user request
- Putting baselines under `tests/artifacts/`
- Recreating Vite/Playwright configs at the repo root
- Driving full Tauri WebView e2e (out of scope; Vite fixtures only)

## When to use this skill

- User runs `/tester-pro`
- User asks to run tests, add missing tests, or verify UI visually
- After UI/theme/font changes that should be covered by existing surfaces

## Related

- Slash command: `.cursor/commands/tester-pro.md`
- Scaffolding skill: `create-skill-pro`
