Follow the `add-tauri-command` skill at `.cursor/skills/add-tauri-command/SKILL.md`.

Add a new Tauri command end-to-end: handler in `src-tauri/src/commands/commands.rs`, register in `src-tauri/src/lib.rs`, update capabilities if needed, type it in `src/app/types/tauri.ts`, and call it via `invoke()` from the frontend when appropriate.

Ask for the command name and purpose if the user did not specify them.
