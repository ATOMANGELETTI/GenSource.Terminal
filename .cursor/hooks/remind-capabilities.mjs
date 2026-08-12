#!/usr/bin/env node
/**
 * afterFileEdit: remind the agent to keep Tauri capability files in sync.
 * Fail-open on parse errors; no-op when the edit is unrelated.
 */
import { readFileSync } from "node:fs";

function readInput() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function noop() {
  process.stdout.write("{}");
}

const input = readInput();
if (input === null) {
  noop();
  process.exit(0);
}

const candidates = [
  input.filePath,
  input.path,
  input.file,
  input.uri,
  ...(Array.isArray(input.files) ? input.files : []),
  ...(Array.isArray(input.edits)
    ? input.edits.map((e) => e?.path ?? e?.filePath)
    : []),
]
  .filter(Boolean)
  .map(String);

const touchedCapabilities = candidates.some((p) =>
  /src-tauri[/\\]capabilities[/\\].*\.json$/i.test(p.replace(/\\/g, "/")),
);

if (!touchedCapabilities) {
  noop();
  process.exit(0);
}

const message =
  "Capability file edited: if permissions changed, keep " +
  "`src-tauri/capabilities/default.json` and `desktop.json` in sync, " +
  "and regenerate schemas if the Tauri CLI provides a schema step.";

process.stdout.write(
  JSON.stringify({
    agent_message: message,
    additional_context: message,
  }),
);
process.exit(0);
