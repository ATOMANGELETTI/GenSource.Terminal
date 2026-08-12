---
name: add-react-page
description: Add a new React page under src/app/pages/ following this template's layout, styles, and types conventions. Use when asked to create a page, screen, window view, or new route-level UI component in the frontend.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Add a React page

## Instructions

1. Create the page component under `src/app/pages/` using a PascalCase
   filename (match existing style such as `Window.tsx`).
2. If the page needs styles, prefer existing trees under `src/app/styles/`
   (including `styles/modules/` when that layout already exists) rather than
   inventing a parallel CSS root.
3. Put shared types in `src/app/types/`. Tauri IPC types go in `tauri.ts`.
4. Wire the page from `App.tsx` / `main.tsx` only as far as those entry
   files already imply — do not invent a second router stack unless one
   already exists in the template.
5. Keep content minimal and purposeful; many files are still empty
   placeholders — fill what you touch, do not scatter unused boilerplate.

## When to use

- User asks for a new page, screen, or main UI view
- Slash command `/new-page` is invoked

## Related

- Slash command: `.cursor/commands/new-page.md`
- Rule: `.cursor/rules/frontend-react.mdc`
