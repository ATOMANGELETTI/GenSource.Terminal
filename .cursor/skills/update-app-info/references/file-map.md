# App identity file map

Authoritative human checklist:
[`other/documents/packaging.md`](../../../../other/documents/packaging.md)
(Fork identity checklist).

## Version (Mode A + Mode B when version changes)

| Path | Fields |
| --- | --- |
| `other/configs/appinfo.json` | `version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `[package].version` |
| `package.json` | `version` |
| `package-lock.json` | top-level `name`/`version` (via `npm install`) |
| `src/app/lib/e2e-window.ts` | stub `version` |

## Product / packaging identity (Mode B)

| Path | Fields |
| --- | --- |
| `other/configs/appinfo.json` | `name`, `productName`, `identifier`, `publisher`, `description` (+ version) |
| `src-tauri/tauri.conf.json` | `productName`, `identifier`, window `title`s, `plugins.cli.description`, `plugins.deep-link.desktop.schemes` |
| `src-tauri/Cargo.toml` | `[package].name`, `description`, `authors` |
| `package.json` | `name`, `description` |
| `index.html` | `<title>` |

## UI / string fallbacks (Mode B)

Replace the previous product display string (template default:
`GenSource Template`) in:

- `src/app/App.tsx`
- `src/app/pages/splash/SplashWindow.tsx`
- `src/app/pages/tray-menu/TrayMenuWindow.tsx`
- `src/app/lib/e2e-window.ts` (`productName`, `description`, `publisher`)
- `src-tauri/src/lib.rs` (tray / expect / log fallbacks)
- `src/scripts/package.js` (fallback `productName` only)

Runtime UI prefers `get_app_info` / `appinfo.json`; fallbacks matter for
splash, e2e, and pre-load paths.

## Codename derivations

Given kebab-case `codename` (example: `notes`):

| Output | Example |
| --- | --- |
| Cargo / npm name | `gensource-notes` |
| Identifier | `com.gensource.notes` |
| Deep-link scheme | `notes` (or ask for `gensource-notes` if collision risk) |

## Out of scope unless user asks

- `public/icons/` / `src-tauri/icons/` regeneration
- `src-tauri/capabilities/*` grant changes
- Updater `pubkey` / `endpoints`
- README / `other/documents/*` narrative
- `.cursor/AGENTS.md` and skill `metadata.author`
- Renaming the git workspace folder
