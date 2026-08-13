# Portable databases (`other/database/`)

Structured local data that ships **beside the `.exe`** (dev: repo `other/database/`). Paths are resolved at runtime from the executable (or `CARGO_MANIFEST_DIR` in `tauri dev`) — never hard-coded machine paths.

| Location | Path |
| --- | --- |
| Dev | `<repo>/other/database/` |
| Install | `<folder next to the .exe>/other/database/` |

Runtime files (`*.db`, WAL/SHM, Stronghold vault + salt) are gitignored and are **not** bundled as user data. Empty folders + this README ship so the tree exists on first run.

## Layout

| Path | Purpose |
| --- | --- |
| `sqlite/agents/chats/chats.db` | Agent conversation list + messages (created at runtime) |
| `sqlite/agents/memory/` | Reserved for agent memory later |
| `sqlite/app/` | Reserved for non-agent SQLite later |
| `stronghold/vault.hold` | Encrypted Stronghold snapshot (Gemini API key) |
| `stronghold/salt.txt` | Argon2 salt for vault key derivation |

The Agents panel talks to SQLite through typed Rust `invoke()` commands (sqlx). `@tauri-apps/plugin-sql` stays registered for kitchen-sink reuse; do **not** `Database.load()` chat files from the webview — that plugin maps `sqlite:` into AppData, not this portable tree.

## Stronghold password

The Gemini API key is **not** stored in `other/configs/agent.json`. Unlock or create the vault on the **Agents** side-panel tab (third rail icon: Agent settings).

**Dev:** put `GENSOURCE_VAULT_PASSWORD` (and optionally `GEMINI_API_KEY` for first-time create) in a gitignored repo-root `.env` / `.env.local` / `.env.dev`. Names only live in [`.env.example`](../../.env.example). Rust loads those files only when `tauri::is_dev()`; packaged builds ignore `.env`.

**Packaged:** set optional `vaultPassword` in `agent.json` (Agents settings: “Save password in agent.json”), or type the password on that page each session.

If an older `agent.json` still has a plaintext `apiKey`, unlocking or creating the vault copies it into Stronghold and clears the JSON field. Saves always strip `providers.*.apiKey`.
