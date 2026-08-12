# Packaging

Windows-first release packaging for GenSource.Template.

## Prerequisites

Same as development: Node 22, Rust/Cargo, and [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/). Packaging also uses:

- Custom NSIS hooks in [`src-tauri/nsis/`](../../src-tauri/nsis/)
- [`other/utilities/7zr.exe`](../utilities/7zr.exe) for archive-related tooling

## Desktop bundle

```bash
npm run tauri:build
```

This runs the logged Tauri build wrapper (`src/scripts/log-tauri-build.js`). Build output is teed under `other/logging/build/` with timestamped log files.

## Release package

```bash
npm run package
npm run package:clean   # wipe release/ first, then package
```

[`src/scripts/package.js`](../../src/scripts/package.js) builds for both:

- `x86_64-pc-windows-msvc` (x64)
- `i686-pc-windows-msvc` (x86)

Artifacts land in `release/` as NSIS installers (per-user or system-wide, via the custom installer hooks) and matching portable zip builds.

## Notes

- Platform focus is **Windows x86 + x64 only**; macOS/Linux packaging is out of scope for this template.
- `tauri:build` defaults to `--target x86_64-pc-windows-msvc`. Use `npm run package` for both architectures.
- Prefer `package` / `package:clean` when you need both architectures and portable zips in one pass.
- For a single Tauri NSIS bundle without the multi-arch packaging step, `tauri:build` is enough.
- After regenerating icons with `npm run tauri -- icon ./public/icons/icon.png`, delete `src-tauri/icons/android/`, `src-tauri/icons/ios/`, and `src-tauri/icons/icon.icns` again (the generator recreates them; this template ships Windows icons only).
- Reclaim Cargo build artifacts with `npm run cargo:clean` (`src-tauri/target/`). `tauri:dev` will rebuild `target/debug` on the next run.
- **Logging is never bundled.** `tauri.conf.json` resources list `other/configs|documents|screenshots|utilities` only (not `other/logging/`). Portable zips skip `logging/` the same way. Build/app tee logs stay on the developer machine so NSIS never tries to pack an open log file.

## Fork identity checklist

When cloning this template into a new GenSource app, update these in lockstep:

| Field | Locations |
| --- | --- |
| Product display name | `src-tauri/tauri.conf.json` `productName`, `other/configs/appinfo.json`, window titles / tray strings |
| Version | `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, root `package.json`, `other/configs/appinfo.json` |
| Bundle identifier | `src-tauri/tauri.conf.json` `identifier` (e.g. `com.gensource.myapp`) |
| Binary / Cargo package name | `src-tauri/Cargo.toml` `[package].name` (also used by `src/scripts/package.js` for the `.exe`) |
| Deep-link scheme | `src-tauri/tauri.conf.json` `plugins.deep-link.desktop.schemes` — **unique per app** to avoid OS collisions |
| Updater | Replace empty `plugins.updater.pubkey` / `endpoints` before enabling update checks |
| Capabilities | Keep splash/tray minimal; grant shell/http/sql/upload/websocket only when the product needs them (`src-tauri/capabilities/`) |
| npm package name | Root `package.json` `name` |
