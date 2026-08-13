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

The Gemini API key is **not** stored in `other/configs/agent.json`. Set a vault password once in **Config → Agents** (first run: password + confirm + key). Later sessions unlock with that password; the key is cached in Rust for the Gemini loop and never sent to Google from the webview.

If an older `agent.json` still has a plaintext `apiKey`, unlocking or creating the vault copies it into Stronghold and clears the JSON field.
