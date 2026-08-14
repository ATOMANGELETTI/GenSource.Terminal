#!/usr/bin/env node
/**
 * Tee `tauri build` stdout/stderr into other/logging/build/[TIME]_[DATE]_[VERSION].log
 * while still streaming to the console. Exit code matches the child process.
 *
 * File contents are filtered by logging.json `build` level toggles. Console is unfiltered.
 */
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnPackageBin } from "./spawn-bin.js";
import {
  allows,
  anyLevelEnabled,
  classifyLine,
  consumeLogChunk,
  loadLoggingConfig,
  stripJsonc,
} from "./logging-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const buildLogDir = join(repoRoot, "other", "logging", "build");
const appinfoPath = join(repoRoot, "other", "configs", "appinfo.json");
const packageJsonPath = join(repoRoot, "package.json");

function toProjectPath(absPath) {
  return relative(repoRoot, absPath).split("\\").join("/");
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

const buildLevels = loadLoggingConfig().build;
const fileEnabled = anyLevelEnabled(buildLevels);

const version = readVersion();
const logPath = join(buildLogDir, formatLogFilename(version));

const header = `[build] started ${new Date().toISOString()} version=${version}\n[build] log=${toProjectPath(logPath)}\n`;
process.stdout.write(header);

let logStream = null;
function getLogStream() {
  if (!fileEnabled) {
    return null;
  }
  if (logStream) {
    return logStream;
  }
  mkdirSync(buildLogDir, { recursive: true });
  logStream = createWriteStream(logPath, { flags: "a" });
  if (allows(buildLevels, "info")) {
    logStream.write(header);
  }
  return logStream;
}

function writeFilteredLine(line, level) {
  if (!allows(buildLevels, level)) {
    return;
  }
  getLogStream()?.write(`${line}\n`);
}

let carry = "";
function tee(chunk, dest) {
  dest.write(chunk);
  if (!fileEnabled) {
    return;
  }
  carry = consumeLogChunk(carry, chunk, writeFilteredLine);
}

function flushCarry() {
  if (!fileEnabled || !carry) {
    return;
  }
  writeFilteredLine(carry, classifyLine(carry));
  carry = "";
}

const extraArgs = process.argv.slice(2);
// Default to Windows x64 so host-arch `target/release` does not grow beside
// the packaging triple used by `npm run package`. Callers may still pass
// `--target` to override.
const hasTarget = extraArgs.some(
  (arg, i) =>
    arg === "--target" ||
    arg.startsWith("--target=") ||
    (arg === "-t" && i + 1 < extraArgs.length) ||
    arg.startsWith("-t="),
);
const buildArgs = hasTarget
  ? extraArgs
  : ["--target", "x86_64-pc-windows-msvc", ...extraArgs];

const child = spawnPackageBin(
  "@tauri-apps/cli",
  ["build", ...buildArgs],
  { cwd: repoRoot },
  "tauri",
);

child.stdout.on("data", (chunk) => tee(chunk, process.stdout));
child.stderr.on("data", (chunk) => tee(chunk, process.stderr));

child.on("error", (err) => {
  const message = `[build] failed to spawn tauri: ${err.message}\n`;
  process.stderr.write(message);
  if (fileEnabled && allows(buildLevels, "error")) {
    getLogStream()?.write(message);
  }
  const done = () => process.exit(1);
  if (logStream) {
    logStream.end(done);
  } else {
    done();
  }
});

child.on("close", (code, signal) => {
  flushCarry();
  const footer = `[build] finished code=${code ?? "null"} signal=${signal ?? "null"} at ${new Date().toISOString()}\n`;
  process.stdout.write(footer);
  if (fileEnabled && allows(buildLevels, "info")) {
    getLogStream()?.write(footer);
  }
  const done = () => process.exit(code ?? 1);
  if (logStream) {
    logStream.end(done);
  } else {
    done();
  }
});
