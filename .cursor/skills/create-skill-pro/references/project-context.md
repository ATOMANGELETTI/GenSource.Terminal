# Project context — GenSource.Template

Keep this file updated as the template gains real content. Skills created by
`create-skill-pro` should reference these paths and conventions.

## What this repo is

A **Tauri v2** desktop app template: React + TypeScript frontend, Rust
backend, packaged for Windows via NSIS. It is a runnable shell with a
macOS-inspired custom titlebar and Nord Polar Night flat UI, intended as the
shared base for a suite of GenSource apps.

## Frontend — `src/app/`

- `App.tsx`, `main.tsx` — app entry points.
- `components/layout/Titlebar.tsx`, `components/ui/TrafficLights.tsx` — chrome.
- `pages/window/window.tsx` — main content (“GenSource Template”).
- `pages/content-menus/` — titlebar / content / tray context menus.
- `styles/index.css` — style entry (Tailwind + module imports only).
- `styles/modules/theme/nord-theme.css` — Nord tokens + `@theme`.
- `styles/modules/layout/{shell,titlebar,window}.css` — chrome layout.
- `styles/modules/motion/transitions.css` — intentional motion.
- `styles/modules/context-menus/` — menu styles.
- `types/{index,tauri}.ts` — shared TS / IPC types.
- `lib/window.ts` — thin window API wrappers (browser-safe for Vite e2e).
- `lib/e2e-window.ts` — `?window=` / `?e2e=1` helpers for Playwright.

New pages go under `src/app/pages/`. New feature CSS goes under
`styles/modules/<area>/` and is imported from `styles/index.css`.

## Testing — `tests/`

- `tests/unit/` — Vitest (`npm test`).
- `tests/e2e/` — Playwright visual + interaction specs (`npm run test:e2e`,
  dedicated Vite port **1421**).
- `tests/e2e/baselines/` — committed screenshot baselines.
- `tests/artifacts/` — gitignored reports/traces (Playwright output).
- `tests/surfaces.json` — required surface registry for `/tester-pro`.
- Update baselines intentionally: `npm run test:e2e:update`.

## Config centralization — `src/configs/`

All tooling config lives under `src/configs/` (not the repo root):

- `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- `eslint.config.js`, `middleware.ts`
- `tsconfig.{base,app,build,e2e,node,test}.json`

Root `tsconfig.json` references these. Do not recreate tooling configs at the
repo root.

## Backend — `src-tauri/src/`

- `lib.rs`, `main.rs` — crate entry points; plugins registered in `lib.rs`.
- `commands/commands.rs` — `#[tauri::command]` handlers (`greet`, `get_app_info`).
- `state/state.rs` — shared Tauri state.
- `mdoels/models.rs` — data models. **Preserve** the `mdoels` path typo.
- `capabilities/{default,desktop}.json` — permission grants.
- Desktop plugins include: log, fs, dialog, store, opener, notification, os,
  process, clipboard-manager, shell, http, deep-link, global-shortcut, updater
  (placeholders), sql, window-state, single-instance, autostart, positioner,
  persisted-scope, stronghold (lazy), upload, websocket, cli.
- `localhost` plugin is omitted (conflicts with Vite/Tauri asset serving).

## UI conventions

- Nord Polar Night palette; flat surfaces only (no gradients/glow/glass).
- Frameless window; traffic lights left; centered title; `data-tauri-drag-region`.
- Typography: Terminus Nerd Font default (`settings.json` `fontFamily`).

## Packaging & tooling

- Windows installer: `src-tauri/nsis/installer.nsh`, `other/utilities/7zr.exe`.
- npm (`.node-version`, `.npmrc`), commitlint, release-it, prettier.
- Envs: `.env`, `.env.dev`, `.env.local`, `.env.prod`, `.env.example` (names only).

## Cursor-native agent config

`.cursor/` holds only Cursor-native surfaces: `AGENTS.md`, `rules/`, `skills/`,
`commands/`, `agents/`, `hooks.json` + `hooks/`, `mcp.json`, `cli.json`.
Root also has `.cursorignore` and a pointer `AGENTS.md`.

## Conventions a new skill should follow

- Use Node `.mjs` for scripts; put automation in `.cursor/hooks/` when shared.
- Fill placeholders in place; do not invent parallel trees or root tooling configs.
- Do not put secrets in `.env.example`.
