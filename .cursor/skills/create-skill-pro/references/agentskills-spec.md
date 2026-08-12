# Agent Skills specification (condensed)

Full spec: https://agentskills.io/specification — this is a condensed
reference so `SKILL.md` bodies don't have to restate it.

## File format

A `SKILL.md` file has two parts: YAML frontmatter between `---` delimiters,
then a Markdown body.

## Frontmatter fields

| Field | Required | Constraints |
|---|---|---|
| `name` | Yes | 1-64 chars. Lowercase letters, numbers, hyphens only. Must not start/end with a hyphen, no consecutive hyphens. Must match the parent directory name. |
| `description` | Yes | 1-1024 chars, non-empty. States **what** the skill does and **when** to use it. Include concrete trigger keywords. |
| `license` | No | License name or reference to a bundled license file. |
| `compatibility` | No | Max 500 chars. Environment requirements (product, system packages, network access). |
| `metadata` | No | Arbitrary string→string map. Use for `author`, `version`, `tags`, etc. `version` is **not** a top-level field. |
| `allowed-tools` | No | Experimental. Space-separated pre-approved tools, e.g. `Bash(git:*) Read`. |

Minimal example:

```markdown
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

## Directory conventions

```
.cursor/skills/<name>/
├── SKILL.md        # required
├── scripts/        # optional — executable code (any language)
├── references/     # optional — detailed docs loaded on demand
└── assets/         # optional — templates, data files, images
```

`examples/` and `resources/` are widely-used community extensions, not
formal spec fields, but are treated as first-class in this project (see
[`../SKILL.md`](../SKILL.md) for how `create-skill-pro` defines each).

`.cursor/skills/` is the **cross-client interoperability** location: tools
that support the Agent Skills spec (Claude Code, Codex, Cursor, Gemini CLI,
GitHub Copilot, and others) scan it directly, alongside any client-native
skills directory. Project-level skills (this repo's `.cursor/skills/`)
override user-level skills (`~/.cursor/skills/`) on a name collision.

## Progressive disclosure (why body length matters)

| Tier | What's loaded | When | Token budget |
|---|---|---|---|
| 1. Catalog | `name` + `description` | Session start | ~50-100 tokens/skill |
| 2. Instructions | Full `SKILL.md` body | Skill activated | <5000 tokens (recommended); keep the file itself under ~500 lines |
| 3. Resources | `scripts/`, `references/`, `assets/`, etc. | Only when the body references them | Varies |

Consequence: keep `SKILL.md`'s body short and put detail in `references/`,
pointed to by relative path.

## Validation leniency (what other tools tolerate)

Most implementations warn-but-load on: name not matching parent dir, name
>64 chars. They **skip** the skill entirely on: missing/empty description,
or completely unparseable YAML. `scripts/validate-skill.mjs` in this skill
checks the stricter rules so problems are caught before they'd cause a
skip elsewhere.
