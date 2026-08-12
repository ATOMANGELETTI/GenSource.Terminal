#!/usr/bin/env node
/**
 * Tee `tauri:dev` stdout/stderr into other/logging/app/[TIME]_[DATE]_[VERSION].log
 * while still streaming to the console. Exit code matches the child process.
 *
 * Structured in-app logs from tauri-plugin-log also land under other/logging/app/
 * (filtered by logging.json); this wrapper captures the full process transcript.
 */
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnPackageBin } from "./spawn-bin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const appLogDir = join(repoRoot, "other", "logging", "app");
const appinfoPath = join(repoRoot, "other", "configs", "appinfo.json");
const packageJsonPath = join(repoRoot, "package.json");

function stripJsonc(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function readVersion() {
  try {
    const appinfo = JSON.parse(stripJsonc(readFileSync(appinfoPath, "utf8")));
    if (typeof appinfo.version === "string" && appinfo.version.trim()) {
      return appinfo.version.trim();
    }
  } catch {
    // fall through
  }
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof pkg.version === "string" && pkg.version.trim()) {
      return pkg.version.trim();
    }
  } catch {
    // fall through
  }
  return "0.0.0";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatLogFilename(version) {
  const now = new Date();
  const time = `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const safeVersion = version.replace(/[\\/:*?"<>|]/g, "_");
  return `${time}_${date}_${safeVersion}.log`;
}

mkdirSync(appLogDir, { recursive: true });

const version = readVersion();
const logPath = join(appLogDir, formatLogFilename(version));
const logStream = createWriteStream(logPath, { flags: "a" });

const header = `[app] started ${new Date().toISOString()} version=${version}\n[app] log=${logPath}\n`;
process.stdout.write(header);
logStream.write(header);

const extraArgs = process.argv.slice(2);
const child = spawnPackageBin(
  "@tauri-apps/cli",
  ["dev", ...extraArgs],
  { cwd: repoRoot },
  "tauri",
);

function tee(chunk, dest) {
  dest.write(chunk);
  logStream.write(chunk);
}

child.stdout.on("data", (chunk) => tee(chunk, process.stdout));
child.stderr.on("data", (chunk) => tee(chunk, process.stderr));

function shutdown(code, signal) {
  const footer = `[app] finished code=${code ?? "null"} signal=${signal ?? "null"} at ${new Date().toISOString()}\n`;
  process.stdout.write(footer);
  logStream.write(footer);
  logStream.end(() => {
    process.exit(code ?? 1);
  });
}

child.on("error", (err) => {
  const message = `[app] failed to spawn tauri: ${err.message}\n`;
  process.stderr.write(message);
  logStream.write(message);
  logStream.end(() => process.exit(1));
});

child.on("close", (code, signal) => {
  shutdown(code, signal);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    try {
      child.kill(sig);
    } catch {
      // child may already be gone
    }
  });
}
