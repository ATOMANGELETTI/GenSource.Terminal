# Runtime app config (`other/configs/`)

User-editable preferences shipped beside the installed `.exe` under `other/configs/`.

| Location | Path |
| --- | --- |
| Dev | `<repo>/other/configs/` |
| Install | `<folder next to the .exe>/other/configs/` |

Open this folder from the app with **Ctrl+,**. Files may use `//` or `/* */` comments (JSONC); the app strips them when loading. Prefer keeping the JSON files comment-free and documenting options here.

Unknown keys are ignored; missing keys fall back to defaults.

---

## `appinfo.json`

App identity (name, product name, identifier, version, publisher, description). Prefer keeping it visible but read-only when the platform allows.

---

## `settings.json`

User preferences for the UI shell. Edit and save — changes apply automatically while the app is running (file watcher).

| Key | Description |
| --- | --- |
| `theme` | Theme preference (case-insensitive; short aliases OK). See values below. |
| `fontFamily` | Font family for app chrome. Known mapped faces: `Terminus` (default), `Ubuntu`, `Fira Code`, `Plus Jakarta Sans`. Any other name is used as a CSS `font-family` with Terminus fallback. |
| `fontSize` | Base UI font size in CSS pixels (positive number; default `14`). |
| `startMinimized` | If `true`, hide the main window on launch (pair with tray / `window.show`). |
| `autostart` | If `true`, launch the app when the OS signs in. |
| `alwaysOnTop` | If `true`, keep the main window above other windows. |

Do **not** store window width/height/position here — geometry is handled by the window-state plugin (writing it caused move/flash issues).

### `theme` values

**Fixed** (ignore OS light/dark):

| Value | Aliases | Effect |
| --- | --- | --- |
| `nord-polar-night` | `polar-night` | Dark Polar Night |
| `nord-snow-storm` | `snow-storm` | Light Snow Storm |
| `nord-frost-dark` | `frost-dark` | Frost dark only |
| `nord-frost-light` | `frost-light` | Frost light only |
| `nord-aurora-dark` | `aurora-dark` | Aurora dark only |
| `nord-aurora-light` | `aurora-light` | Aurora light only |

**Follow OS** light/dark (re-apply when the system scheme changes):

| Value | Aliases | Effect |
| --- | --- | --- |
| `system` | — | polar-night ↔ snow-storm |
| `nord-frost` | `frost` | frost dark ↔ frost light |
| `nord-aurora` | `aurora` | aurora dark ↔ aurora light |

---

## `logging.json`

Controls which log levels are written to `other/logging/app/`. Edit and save — changes apply automatically while the app is running.

Set each level to `true` (include) or `false` (exclude):

| Key | Notes |
| --- | --- |
| `error`, `warn`, `info`, `debug`, `trace` | Map to the Rust `log` crate levels |
| `fatal` | Separate channel (error-level messages tagged with target `gensource::fatal`) |

Build logs under `other/logging/build/` are full transcripts and ignore this file.

---

## `keybindings.json`

Keyboard shortcuts for menu and window actions.

1. Change `shortcut`, `enabled`, or `scope` on an existing binding and save.
2. Restart the app for **global** shortcuts to re-register. **Local** shortcuts are read when the frontend loads — restart or reload after edits.

### Binding fields

| Field | Description |
| --- | --- |
| `id` | Stable action id wired in code. Do not rename unless you also update the Rust/frontend handlers. |
| `shortcut` | Chord string, e.g. `Ctrl+Shift+G`, `Ctrl+=`, `Ctrl+,`. Use `""` and `"enabled": false` to leave an action unbound. |
| `enabled` | `false` skips registration / in-app handling. |
| `scope` | `global` = OS-wide (works even when unfocused; handled in Rust). `local` = only while this app window is focused (frontend). Prefer `local` for editing keys (Reload, Copy, Paste, Zoom, …) so they do not hijack other applications. |

Modifier names: `Ctrl`, `Shift`, `Alt`, `Super`/`Meta` (platform-dependent).

### Binding ids

**Global (Rust / OS-wide)**

| id | Default | Purpose |
| --- | --- | --- |
| `window.show` | `Ctrl+Shift+G` | Show + focus the main window (even when hidden / unfocused) |
| `window.hide` | `Ctrl+Shift+H` | Hide the main window |
| `app.quit` | `Ctrl+Shift+Q` | Quit the application |

**Local content / menus (frontend)**

| id | Default | Purpose |
| --- | --- | --- |
| `content.reload` | `Ctrl+R` | Reload the webview |
| `content.zoomIn` | `Ctrl+=` | Zoom in |
| `content.zoomOut` | `Ctrl+-` | Zoom out |
| `content.zoomReset` | `Ctrl+0` | Reset zoom |
| `content.copy` | `Ctrl+C` | Copy |
| `content.paste` | `Ctrl+V` | Paste |
| `content.preferences` | `Ctrl+,` | Open this `other/configs/` folder in the system file manager |
| `content.about` | *(unbound)* | Menu label only / future hook |

**Local titlebar**

| id | Default | Purpose |
| --- | --- | --- |
| `titlebar.toggleWindow` | `Ctrl+M` | Minimize (macOS-style hide-to-dock/taskbar toggle in this shell) |
| `titlebar.toggleMaximize` | `Ctrl+Shift+M` | Toggle maximize |
| `titlebar.close` | `Ctrl+W` | Close |

**Tray / extras**

| id | Default | Purpose |
| --- | --- | --- |
| `tray.checkUpdates` | *(unbound)* | Reserved for tray “Check for updates” |
