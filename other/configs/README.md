# Runtime app config (`other/configs/`)

User-editable preferences shipped beside the installed `.exe` under `other/configs/` (`appinfo.json`, `settings.json`, `keybindings.json`, `logging.json`, `agent.json`).

## Hardware temperatures (status bar)

CPU / GPU / RAM °C use LibreHardwareMonitor (`lhm-sys`) first, then NVML (NVIDIA GPU) and WMI fallbacks.

- **Build:** Windows builds that enable LHM need **.NET SDK 8** (`winget install Microsoft.DotNet.SDK.8`) so the NativeAOT bridge can compile.
- **Runtime:** The first time the sensor driver loads, Windows may prompt for **administrator elevation** (same class of requirement as Speccy / LibreHardwareMonitor). Decline or failure is fine — usage metrics still work; missing sensors show as `—`.

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

User preferences for the UI shell and terminal. Edit and save — changes apply automatically while the app is running (file watcher).

| Key | Description |
| --- | --- |
| `theme` | Theme preference (case-insensitive; short aliases OK). See values below. |
| `fontFamily` | Font family for app chrome. Known mapped faces: `Terminus` (default), `Ubuntu`, `Fira Code`, `Plus Jakarta Sans`. Any other name is used as a CSS `font-family` with Terminus fallback. |
| `fontSize` | Base UI font size in CSS pixels (positive number; default `14`). |
| `particleEffect` | Terminal particle background mode: `dust` (default), `constellation`, or `orbs`. Invalid values fall back to `dust`. Hot-swaps while the app is running. |
| `startMinimized` | If `true`, hide the main window on launch (pair with tray / `window.show`). |
| `autostart` | If `true`, launch the app when the OS signs in. |
| `alwaysOnTop` | If `true`, keep the main window above other windows. |
| `defaultProfile` | Profile `id` used for new tabs and empty launch (`powershell` or `cmd`; default `powershell`). |
| `terminalFontFamily` | Optional terminal font; omit or `null` to fall back to `fontFamily` (same allowlist / CSS-family rules). |
| `terminalFontSize` | Optional terminal font size in px; omit or `null` to fall back to `fontSize`. |
| `scrollbackLines` | xterm scrollback buffer and pin truncate limit (default `5000`; clamped to `[100, 100000]`). |
| `cursorStyle` | xterm cursor: `block`, `underline`, or `bar` (default `bar`). Invalid values fall back to `bar`. |
| `cursorBlink` | If `true`, blink the terminal cursor (default `true`). |
| `fileIconSet` | File explorer icon style: `catppuccin` (default), `material`, or `nord`. Aliases: `cat`, `mat`, `nord-native`. Hot-swaps while the app is running. |
| `profiles` | Array of shell profiles (see below). Empty / missing → built-in PowerShell + CMD. |

Do **not** store window width/height/position here — geometry is handled by the window-state plugin (writing it caused move/flash issues).

Do **not** store pinned tabs here — pins live only in AppData `app-state.json` via the plugin-store key `terminal.pinnedTabs`.

### `profiles` entries

| Field | Description |
| --- | --- |
| `id` | Stable key (`powershell`, `cmd`, or a custom id used when spawning by id). |
| `name` | Display / tab label. |
| `command` | Executable name or path resolved on `PATH` (e.g. `powershell.exe`). |
| `args` | Argument list (default `[]`). |
| `startingDirectory` | Absolute start directory, or `null` / omit for user home. |

Shipped defaults:

1. `powershell` → `powershell.exe` with `["-NoLogo"]`
2. `cmd` → `cmd.exe` with `[]`

Changing `profiles` / `defaultProfile` affects **subsequent** new tabs only, not running sessions.

### Terminal prompt (PowerShell)

PowerShell sessions automatically load the bundled Nord 2-line powerline prompt from `other/prompts/nord-powerline.ps1` (no oh-my-posh). Spawn injects `-ExecutionPolicy Bypass -NoProfile -NoExit -Command` and sets `GENSOURCE_THEME` from the current `theme` setting so segment colors follow Polar Night vs Snow Storm / `*-light` (and OS light/dark for `system` / `frost` / `aurora`). Bypass is **per session / process-scoped only** — it does not change machine or user execution policy. CMD profiles stay a plain shell. Prompt init is automatic — you do not need prompt args on the `powershell` profile. If a profile already uses `-Command` / `-File`, injection is skipped.

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

### `particleEffect` values

| Value | Look |
| --- | --- |
| `dust` | Soft layered motes with sine drift (default; quietest) |
| `constellation` | Dust plus subtle proximity links (no cursor interaction) |
| `orbs` | Fewer larger soft radial orbs with slow drift |

---

## `logging.json`

Controls which log levels are written under `other/logging/`. Edit and save — app and agent filters apply while the app is running; build/app tee wrappers read this file when `tauri:dev` / `tauri:build` starts.

Each of `app`, `build`, and `agent` has the same level keys. Set a level to `true` (include) or `false` (exclude). Console output is never filtered.

| Section | Directory | Notes |
| --- | --- | --- |
| `app` | `other/logging/app/` | Rust `log` plugin + `tauri:dev` process tee |
| `build` | `other/logging/build/` | `tauri:build` process tee. Lines are classified (`error:` / `[WARN]` / …); unmatched lines count as `info`. |
| `agent` | `other/logging/agent/` | Dedicated agent chat/tool log |

Level keys (`error`, `warn`, `info`, `debug`, `trace`) map to the Rust `log` crate (and classified transcript lines). `fatal` is a separate channel (error-level messages tagged with target `gensource::fatal`).

`agent` also has content toggles. An event is written only when **both** its level and (when it has a category) its category are on:

| Key | Notes |
| --- | --- |
| `prompts` | User messages sent to the model |
| `replies` | Final visible assistant text (not every stream chunk) |
| `tools` | Tool calls, confirm allow/deny, results |
| `reasoning` | Model thought text (default off) |

Failures and cancels use agent **levels** only. API keys and vault passwords are never written. Oversized payloads are truncated.

Legacy files with top-level `error` / `warn` / … (no `app` object) are lifted into `app` on load. The next Config save writes the nested shape.

Shipped default:

```json
{
  "app": {
    "error": true,
    "warn": true,
    "info": true,
    "debug": true,
    "trace": true,
    "fatal": true
  },
  "build": {
    "error": true,
    "warn": true,
    "info": true,
    "debug": false,
    "trace": false,
    "fatal": true
  },
  "agent": {
    "error": true,
    "warn": true,
    "info": true,
    "debug": false,
    "trace": false,
    "fatal": true,
    "prompts": true,
    "replies": true,
    "tools": true,
    "reasoning": false
  }
}
```

---

## `agent.json`

AI agent provider settings for the **Agents** side-panel tab. Multi-provider-ready schema; **Gemini** is the only wired provider in v1.

The Gemini **API key is not stored here**. It lives in the portable Stronghold vault under `other/database/stronghold/`. Set the vault password and key on the **Agents** side-panel tab (third rail icon: Agent settings). Rust caches the key after unlock for the chat/tool loop; the webview never calls Google HTTP APIs directly.

**Unlock order**

1. **Dev** (`tauri dev`) — gitignored repo-root `.env` / `.env.local` / `.env.dev` `GENSOURCE_VAULT_PASSWORD` (optional `GEMINI_API_KEY` for first-time vault create). Rust loads these only when `tauri::is_dev()`. Packaged builds ignore `.env`. See [`.env.example`](../../.env.example) for names only.
2. **Packaged / portable** — optional `vaultPassword` on this file, or type the password on Agents settings.
3. **Manual** — Agents settings if neither is set.

| Key | Description |
| --- | --- |
| `activeProvider` | Provider id under `providers` (default `gemini`). |
| `providers.gemini.apiKey` | Always empty. Leftover plaintext keys are copied into the vault on unlock/create, then stripped on every save. |
| `providers.gemini.model` | Model id (default `gemini-3.6-flash`). |
| `vaultPassword` | Optional. When set, the Agents tab auto-unlocks the vault. Omit or leave empty — the field is not written. Never copy a `.env` password here automatically; use **Save password in agent.json** on Agents settings if you want a portable copy. |
| `systemPrompt` | Optional system preamble for the agent. A fixed chat-vs-terminal routing policy is always appended in Rust and cannot be removed via this field. |

Later providers (`openai`, `anthropic`, …) add sibling objects under `providers` without reshaping the file.

Shipped default:

```json
{
  "activeProvider": "gemini",
  "providers": {
    "gemini": {
      "apiKey": "",
      "model": "gemini-3.6-flash"
    }
  },
  "systemPrompt": "You are GenSource Terminal's agent. Reply in the Agents chat panel. Use tools for files, git, and settings when helpful. Only use the terminal tool when the user asks you to run a shell command."
}
```

Edit the model via **Agents → Agent settings** (third rail icon), or by hand. Create or unlock the vault there to set the API key. The configs watcher reloads when the file changes on disk. See [`other/database/README.md`](../database/README.md) for vault + SQLite layout.

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

**Local terminal**

| id | Default | Purpose |
| --- | --- | --- |
| `terminal.newTab` | `Ctrl+Shift+T` | New tab (`defaultProfile`) |
| `terminal.closeTab` | `Ctrl+Shift+W` | Close active tab |
| `terminal.togglePin` | `Ctrl+Shift+P` | Pin / unpin active tab |
| `terminal.search` | `Ctrl+F` | Open in-terminal find |
| `terminal.clear` | `Ctrl+Shift+K` | Clear xterm buffer (does not kill PTY) |

Copy / paste for the terminal reuse `content.copy` / `content.paste` (selection → clipboard; no selection + focused terminal → Ctrl+C to PTY; paste → `pty_write`). Wiring lives in the main window shortcut handlers.

**Tray / extras**

| id | Default | Purpose |
| --- | --- | --- |
| `tray.checkUpdates` | *(unbound)* | Reserved for tray “Check for updates” |
