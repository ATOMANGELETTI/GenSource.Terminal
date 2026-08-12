---
name: add-tauri-command
description: Add a new Tauri v2 command end-to-end in this template — Rust handler, invoke registration, capabilities, and typed frontend invoke. Use when asked to add a Tauri command, expose a new IPC API, or wire invoke() to the backend.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Add a Tauri command

## Instructions

1. Add a new `#[tauri::command]` function to
   `src-tauri/src/commands/commands.rs`. Prefer `Result`-style errors over
   bare `unwrap()` on the command path.
2. Register it in the `invoke_handler![...]` list in `src-tauri/src/lib.rs`.
3. If the command needs elevated permissions, add a matching entry to
   `src-tauri/capabilities/default.json` and `desktop.json` when the grant
   is desktop-specific.
4. If the command's args/return type are new, add or extend types in
   `src/app/types/tauri.ts`.
5. Call it from the frontend via Tauri `invoke()`, typically from a
   component under `src/app/pages/`.
6. Preserve the `mdoels` directory spelling unless the user asked to rename
   it. Do not invent a second commands module tree.

Many of these files may still be empty placeholders — write the minimal
real content needed for the command; do not fabricate unrelated app logic.

## When to use

- User asks for a new Tauri command / IPC endpoint
- Frontend needs a new `invoke("...")` backend API

## Related

- Slash command: `.cursor/commands/new-tauri-command.md`
- Calibration example (not activated):
  `../create-skill-pro/examples/tauri-command-skill/SKILL.md`
