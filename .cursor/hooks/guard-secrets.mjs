#!/usr/bin/env node
/**
 * beforeShellExecution: ask before staging secret env files or writing
 * real-looking secrets into .env.example. Fail-open on parse errors.
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

function allow() {
  process.stdout.write(JSON.stringify({ permission: "allow" }));
}

function ask(userMessage, agentMessage) {
  process.stdout.write(
    JSON.stringify({
      permission: "ask",
      user_message: userMessage,
      agent_message: agentMessage,
    }),
  );
}

const input = readInput();
if (input === null) {
  allow();
  process.exit(0);
}

const command = String(input.command ?? input.commandLine ?? "");
const lower = command.toLowerCase();

const secretEnvAdd =
  /\bgit\s+add\b/.test(lower) &&
  /(^|[\s/\\])(\.env|\.env\.local|\.env\.dev|\.env\.prod)([\s"']|$)/.test(
    lower,
  );

const envExampleSecretWrite =
  /\.env\.example\b/.test(lower) &&
  /(api[_-]?key|secret|password|token|private[_-]?key)\s*=\s*\S+/i.test(
    command,
  );

if (secretEnvAdd) {
  ask(
    "This command stages a secret-bearing env file (.env / .env.local / .env.dev / .env.prod). Review before continuing.",
    "Hook: refuse to auto-stage secret env files unless the user confirms they contain no secrets.",
  );
  process.exit(0);
}

if (envExampleSecretWrite) {
  ask(
    "This command looks like it writes a real secret into .env.example. Review before continuing.",
    "Hook: .env.example must document variable names only — never real secret values.",
  );
  process.exit(0);
}

allow();
process.exit(0);
