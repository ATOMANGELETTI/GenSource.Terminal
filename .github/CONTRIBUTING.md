# Contributing

Thanks for contributing to **GenSource.Template** — the shared Tauri v2 desktop template for the GenSource suite.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- [Node.js 22](https://nodejs.org/) (see [`.node-version`](../.node-version))
- [Rust](https://www.rust-lang.org/tools/install) with Cargo
- [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri:dev
```

Frontend-only: `npm run dev`.

## Documentation

| Guide | Description |
| --- | --- |
| [README](../README.md) | Quick start and scripts |
| [Development](../other/documents/development.md) | Layout, env files, tests |
| [Packaging](../other/documents/packaging.md) | Windows NSIS / portable zips, fork identity |
| [Security](SECURITY.md) | Vulnerability reporting |

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (see [`.commitlintrc`](../.commitlintrc)):

```text
feat: add tray theme sync
fix: prevent window flash on restore
docs: clarify packaging fork checklist
```

## Pull requests

1. Open a PR against `main` with a clear summary.
2. Complete the PR template checklist (`lint`, `typecheck`, unit tests; e2e when UI changes).
3. Do **not** commit secrets. [`.env.example`](../.env.example) is names/placeholders only.
4. Update docs under `other/documents/` when behavior or packaging changes.
5. If you touch product identity (`tauri.conf.json`, `appinfo.json`, bundle id, deep-link scheme, etc.), follow the [fork identity checklist](../other/documents/packaging.md#fork-identity-checklist).

## Issues

Use the bug or feature issue forms when possible. Security issues: see [SECURITY.md](SECURITY.md) — do not file them publicly.

## Releases

Maintainers publish with `npm run release` ([release-it](../.release-it.json)); contributors do not need to bump versions in normal PRs unless asked.
