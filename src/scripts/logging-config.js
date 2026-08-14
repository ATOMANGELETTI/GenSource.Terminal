#!/usr/bin/env node
/**
 * Shared logging.json loader and transcript line classifier for the
 * tauri:dev / tauri:build tee wrappers.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const loggingPath = join(repoRoot, "other", "configs", "logging.json");

const LEVEL_KEYS = ["error", "warn", "info", "debug", "trace", "fatal"];

export const DEFAULT_LEVELS = {
  error: true,
  warn: true,
  info: true,
  debug: false,
  trace: false,
  fatal: true,
};

export function stripJsonc(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function pickLevels(obj) {
  const out = { ...DEFAULT_LEVELS };
  if (!obj || typeof obj !== "object") {
    return out;
  }
  for (const key of LEVEL_KEYS) {
    if (typeof obj[key] === "boolean") {
      out[key] = obj[key];
    }
  }
  return out;
}

function normalizeLogging(parsed) {
  const hasApp = parsed && typeof parsed.app === "object" && parsed.app !== null;
  const app = pickLevels(hasApp ? parsed.app : parsed);
  const build = pickLevels(parsed?.build);
  const agentSrc =
    parsed?.agent && typeof parsed.agent === "object" ? parsed.agent : {};
  return {
    app,
    build,
    agent: {
      ...pickLevels(agentSrc),
      prompts: typeof agentSrc.prompts === "boolean" ? agentSrc.prompts : true,
      replies: typeof agentSrc.replies === "boolean" ? agentSrc.replies : true,
      tools: typeof agentSrc.tools === "boolean" ? agentSrc.tools : true,
      reasoning:
        typeof agentSrc.reasoning === "boolean" ? agentSrc.reasoning : false,
    },
  };
}

export function loadLoggingConfig() {
  try {
    const parsed = JSON.parse(stripJsonc(readFileSync(loggingPath, "utf8")));
    return normalizeLogging(parsed);
  } catch {
    return normalizeLogging({});
  }
}

export function anyLevelEnabled(section) {
  return LEVEL_KEYS.some((key) => Boolean(section?.[key]));
}

export function allows(section, level) {
  return Boolean(section?.[level]);
}

/**
 * Classify a transcript / plugin log line into a logging.json level key.
 */
export function classifyLine(line) {
  const text = String(line);
  const tagged = text.match(/\[(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL)\]/i);
  if (tagged) {
    const token = tagged[1].toUpperCase();
    if (token === "WARNING" || token === "WARN") {
      return "warn";
    }
    return token.toLowerCase();
  }
  const trimmed = text.trim();
  if (/^fatal:/i.test(trimmed) || /\bPANIC\b/.test(text)) {
    return "fatal";
  }
  if (/^error(\[|:|\s)/i.test(trimmed) || /\berror\[E\d+\]/i.test(text)) {
    return "error";
  }
  if (/^warning:/i.test(trimmed) || /^warn:/i.test(trimmed)) {
    return "warn";
  }
  if (/^debug:/i.test(trimmed)) {
    return "debug";
  }
  if (/^trace:/i.test(trimmed)) {
    return "trace";
  }
  return "info";
}

/**
 * Split a chunk into complete lines, classify each, and keep an incomplete tail.
 */
export function consumeLogChunk(carry, chunk, onLine) {
  const combined = carry + chunk.toString();
  const parts = combined.split(/\r?\n/);
  const next = parts.pop() ?? "";
  for (const line of parts) {
    onLine(line, classifyLine(line));
  }
  return next;
}
