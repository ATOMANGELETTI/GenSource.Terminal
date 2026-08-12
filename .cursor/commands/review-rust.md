Follow the `review-rust` checklist and prefer the `rust-tauri-reviewer` subagent at `.cursor/agents/rust-tauri-reviewer.md`.

Review Rust/Tauri changes under `src-tauri/` for this template.

Check for:

1. Bare `unwrap()` / `expect()` on command paths that should use `?` or mapped errors
2. New `#[tauri::command]` functions missing from the `invoke_handler` in `src-tauri/src/lib.rs`
3. Capability/permission drift vs `src-tauri/capabilities/default.json` and `desktop.json`
4. Accidental renames of the `mdoels` directory
5. Commands that need frontend types in `src/app/types/tauri.ts` but do not have them

Report findings as Critical / Suggestion / Nice-to-have. Do not rewrite unrelated placeholders.
