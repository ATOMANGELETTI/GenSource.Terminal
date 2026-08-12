Follow the `review-frontend` checklist and prefer the `frontend-reviewer` subagent at `.cursor/agents/frontend-reviewer.md`.

Review React/TypeScript frontend changes under `src/app/` for this template.

Check for:

1. Pages living outside `src/app/pages/` or wrong filename casing
2. Styles placed outside the existing `src/app/styles/` layout
3. Missing or outdated Tauri IPC types in `src/app/types/tauri.ts`
4. `invoke()` call sites without matching backend commands / types
5. Invented parallel folder structures that fight the template layout

Report findings as Critical / Suggestion / Nice-to-have. Do not rewrite unrelated placeholders.
