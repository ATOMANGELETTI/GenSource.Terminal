# Development

Day-to-day workflow for GenSource.Template.

## Frontend only

Run the Vite app without the Tauri shell:

```bash
npm run dev
```

Use `npm run tauri:dev` when you need the desktop window, tray, or native plugins.

## Environment files

Copy names from [`.env.example`](../../.env.example). Do **not** commit real secrets.

| File | Typical use |
| --- | --- |
| `.env` / `.env.dev` / `.env.prod` / `.env.local` | Local overrides — **gitignored** |
| `.env.example` | Documented variable **names** only (the only env file that should be tracked) |

## Layout

| Path | Role |
| --- | --- |
| `src/app/` | React UI (`App.tsx`, `main.tsx`, `pages/`, `styles/modules/`, `types/`) |
| `src/configs/` | Vite, Vitest, Playwright, ESLint, and purpose-split tsconfigs |
| `src/scripts/` | npm runners (`dev`, `tauri:dev` / `tauri:build` logging wrappers, `package`) |
| `src-tauri/` | Rust backend, capabilities, NSIS hooks |
| `other/configs/` | Runtime app config shipped beside the installed exe (`appinfo.json`, `settings.json`, `keybindings.json`) |
| `other/logging/` | App, build, and agent log directories |
| `tests/` | Unit (`unit/`) and Playwright e2e (`e2e/`); artifacts under `tests/artifacts/` |
| `.cursor/` | Cursor rules, skills, commands, hooks, and agent instructions |

Tooling config stays under `src/configs/` — do not recreate Vite/ESLint/Vitest/Playwright configs at the repo root.

## Testing

```bash
npm test                  # Vitest unit tests
npm run test:e2e          # Playwright visual + e2e (port 1421)
npm run test:e2e:update   # Regenerate Playwright screenshot baselines
```

Surface inventory for coverage work lives in [`tests/surfaces.json`](../../tests/surfaces.json).

## Contributing

Issue and pull request templates, security policy, and contributor guide live under [`.github/`](../../.github/CONTRIBUTING.md).

## Agents

Canonical project instructions for AI coding agents: [`.cursor/AGENTS.md`](../../.cursor/AGENTS.md).
