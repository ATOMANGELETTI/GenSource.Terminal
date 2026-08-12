---
name: tauri-command-skill
description: EXAMPLE ONLY — calibration material for create-skill-pro, not meant to be activated. Demonstrates a small, well-formed, project-tailored skill for adding a new Tauri command to this template.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Add a Tauri command (example skill)

> This skill lives under `create-skill-pro/examples/` as **worked
> calibration material** — read it to see what a good, project-tailored
> skill looks like. For the live skill agents should run, use
> `.cursor/skills/add-tauri-command/` instead.

## Instructions

1. Add a new `#[tauri::command]` function to
   `src-tauri/src/commands/commands.rs`.
2. Register it in the `invoke_handler![...]` list in `src-tauri/src/lib.rs`.
3. If the command needs elevated permissions, add a matching entry to
   `src-tauri/capabilities/default.json` (and `desktop.json` if
   desktop-only).
4. If the command's return type is new, add/extend the shared type in
   `src/app/types/tauri.ts` so the frontend call site is typed.
5. Call it from the frontend via the Tauri `invoke()` API, typically from a
   component under `src/app/pages/`.

## Why this is a good example

- **Frontmatter** is spec-compliant: `name` matches the directory, the
  `description` states both what (add a Tauri command) and when (asked to
  add/expose a new Tauri command).
- **Body is short** (well under 500 lines) and defers detail to real repo
  paths instead of generic Tauri advice.
- **References real, project-specific files** — `commands/commands.rs`,
  `lib.rs`, `capabilities/*.json`, `types/tauri.ts` — sourced from
  `../../references/project-context.md`, not invented.
- **No unnecessary subfolders**: this task doesn't need `scripts/` or
  `data/`, so none were added — a real skill should only include the
  subfolders it needs.
