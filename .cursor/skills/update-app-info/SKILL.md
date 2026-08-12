---
name: update-app-info
description: >-
  Updates app identity and version in lockstep across appinfo.json,
  tauri.conf.json, Cargo.toml, package.json, and UI fallbacks. Use when
  bumping version, rebranding a fork from this template, or changing
  productName, codename, identifier, publisher, or description.
metadata:
  author: GenSource.Template
  version: "1.0"
---

# Update App Info

Keep product identity and version synchronized. Never invent names or
versions — ask first. Never “demo” or sample-edit identity on this
checkout unless the user explicitly wants a real change applied.

## Instructions

### 1. Ask intent

Confirm which mode applies:

- **Version only** — bump semver; leave names, identifiers, schemes, and
  UI strings untouched.
- **Rebrand** — new app built from this template; update display name,
  description, publisher, **codename** (machine slug), identifier,
  deep-link scheme, package names, and related fallbacks.

Collect only the fields that mode needs. Do not proceed until the user
supplies concrete values.

### 2. Codename (rebrand)

There is no `codename` field in `appinfo.json`. Treat **codename** as a
kebab-case slug and derive:

| Derived value | Convention |
| --- | --- |
| Cargo / binary name | `gensource-<codename>` in `src-tauri/Cargo.toml` `[package].name` |
| npm package name | same as Cargo name in root `package.json` `name` |
| Bundle identifier | `com.gensource.<codename>` |
| Deep-link scheme | ask if unclear; default to `<codename>` (must be unique per OS install) |

### 3. Mode A — Version only

Set the **same** semver in:

1. `other/configs/appinfo.json` → `version`
2. `src-tauri/tauri.conf.json` → `version`
3. `src-tauri/Cargo.toml` → `[package].version`
4. `package.json` → `version`
5. `src/app/lib/e2e-window.ts` → stub `version`

Then align the root `package-lock.json` top-level `version` (e.g. `npm install`
at repo root). Do not change product names, identifiers, schemes, or
hardcoded UI fallbacks.

### 4. Mode B — Rebrand

Ask for: product/display name, description, publisher (default keep
`GenSource` for suite apps), codename slug, version (if changing), and
deep-link scheme if the default is wrong.

Update in lockstep (see [references/file-map.md](references/file-map.md)):

1. `other/configs/appinfo.json` — `name`, `productName`, `identifier`,
   `version`, `publisher`, `description`
2. `src-tauri/tauri.conf.json` — `productName`, `version`, `identifier`,
   every window `title`, `plugins.cli.description`,
   `plugins.deep-link.desktop.schemes`
3. `src-tauri/Cargo.toml` — `name`, `version`, `description`, `authors`
   when publisher changes
4. `package.json` (+ lockfile) — `name`, `version`, `description`
5. `index.html` — `<title>`
6. Hardcoded `"GenSource Template"` (or old product) fallbacks in:
   - `src/app/App.tsx`
   - `src/app/pages/splash/SplashWindow.tsx`
   - `src/app/pages/tray-menu/TrayMenuWindow.tsx`
   - `src/app/lib/e2e-window.ts`
   - `src-tauri/src/lib.rs`
   - `src/scripts/package.js` (fallback string only)

Leave `plugins.updater.pubkey` / `endpoints` alone unless the user
provides replacements. Do not rename `mdoels/`, move tooling configs, or
regenerate icons unless asked.

### 5. Verify

- Confirm version (and identity fields for rebrand) match across the
  files touched.
- Summarize the diff for the user; call out anything left out of scope
  (icons, capabilities, README narrative, repo folder rename).

### Do not

- Apply Mode A/B as a dry-run demo that leaves the template misbranded.
- Rewrite `.cursor/AGENTS.md`, skill metadata, or long-form docs unless
  the user asks.
- Change capabilities grants or updater secrets without explicit values.
- Invent a parallel `codename` key in JSON unless the user requests a
  schema change.

## When to use

- User asks to bump version / release version
- User rebrands a fork or clones this template into a new GenSource app
- User wants productName, identifier, publisher, description, or
  package/codename slug updated in lockstep

## Additional resources

- Full touchpoint inventory: [references/file-map.md](references/file-map.md)
- Human checklist (same sources): `other/documents/packaging.md` § Fork identity checklist
- Slash command: `.cursor/commands/update-app-info.md`
