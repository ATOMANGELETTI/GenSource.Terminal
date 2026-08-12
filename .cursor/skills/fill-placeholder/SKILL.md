---
name: fill-placeholder
description: Fill empty GenSource.Template placeholder files with minimal real content while preserving path and naming intent. Use when asked to implement a stub, flesh out a 0-byte file, or replace a placeholder without redesigning the template layout.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Fill a placeholder

## Instructions

1. Identify the target path and treat its **name and location** as the
   design — do not move or rename unless asked.
2. Read neighboring files/folders to infer expected role (page, style
   module, command handler, config, etc.).
3. Write the smallest working content that matches that role. Prefer
   compiling/typing correctly over feature-complete product UI.
4. Do **not**:
   - invent parallel trees (`src/components/` when pages belong in
     `src/app/pages/`)
   - recreate tooling configs at the repo root
   - rename `mdoels` unless explicitly requested
   - put secrets in `.env.example`
5. If multiple related placeholders must change together (e.g. command +
   registration + types), update the set in one pass and list what you
   touched.
6. When unsure of intent from an empty file alone, ask before expanding
   scope beyond that file.

## Related

- Subagent: `.cursor/agents/placeholder-implementer.md`
- Rule: `.cursor/rules/project-conventions.mdc`
