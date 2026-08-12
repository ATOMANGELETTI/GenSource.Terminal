# Skill quality checklist

Self-review a drafted skill against this before finalizing. Run
`scripts/validate-skill.mjs` too — it automates the mechanical checks below.

## Frontmatter

- [ ] `name` matches the parent directory name exactly.
- [ ] `name` is 1-64 chars, lowercase letters/numbers/hyphens only, no
      leading/trailing/consecutive hyphens.
- [ ] `description` is 1-1024 chars and states both **what** the skill does
      and **when** to use it, with concrete trigger keywords.
- [ ] `version` (if used) is under `metadata.version`, not top-level.

## Body

- [ ] `SKILL.md` is under ~500 lines / ~5000 tokens.
- [ ] Detailed reference material was moved to `references/`, not inlined.
- [ ] Only the per-skill subfolders (`scripts/`, `references/`, `assets/`,
      `examples/`, `resources/`) actually needed were created — no empty
      placeholders added out of habit.

## Project fit

- [ ] Checked native `.cursor/` surfaces (`rules/`, `commands/`, `agents/`,
      sibling `skills/`, `hooks.json` / `hooks/`, `mcp.json`, `cli.json`) for
      material worth referencing from the new skill.
- [ ] File/path references point at real paths in this repo (cross-checked
      against `../references/project-context.md`), not generic advice.
- [ ] No fabricated project facts — if something is genuinely unknown or the
      template file is still an empty placeholder, the skill says so rather
      than inventing content.
- [ ] Did not introduce non-native agent folders or `.rules.md` /
      `.command.md` / `.agent.md` naming.

## Verification

- [ ] `node .cursor/skills/create-skill-pro/scripts/validate-skill.mjs <path-to-SKILL.md>` passes.
- [ ] The skill's own worked example (if it includes one) actually matches
      what the instructions produce.

## Further reading

- [Agent Skills specification](https://agentskills.io/specification)
- [Best practices for skill creators](https://agentskills.io/skill-creation/best-practices)
- [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)
