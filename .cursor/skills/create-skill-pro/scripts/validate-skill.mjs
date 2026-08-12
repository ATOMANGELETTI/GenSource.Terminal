#!/usr/bin/env node
/**
 * Lint a SKILL.md file against the agentskills.io spec constraints.
 * Dependency-free (no YAML library) so it stays portable — the frontmatter
 * subset used by skills here (flat keys + one nested `metadata` map) is
 * simple enough to parse by hand.
 *
 * Usage:
 *   node validate-skill.mjs <path-to-SKILL.md>
 *
 * Exit code 0 = no errors (warnings are still printed). Exit code 1 = at
 * least one error.
 */

import path from "node:path";
import fs from "node:fs";

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;
const RECOMMENDED_MAX_BODY_LINES = 500;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`Warning: ${message}`);
}

function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== "---") {
    return { frontmatter: null, body: content, bodyStartLine: 0 };
  }
  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (closingIndex === -1) {
    return { frontmatter: null, body: content, bodyStartLine: 0 };
  }
  const frontmatterLines = lines.slice(1, closingIndex + 1);
  const bodyLines = lines.slice(closingIndex + 2);

  const frontmatter = {};
  let currentMapKey = null;
  for (const rawLine of frontmatterLines) {
    if (rawLine.trim() === "") continue;
    const indented = /^\s+/.test(rawLine);
    if (indented && currentMapKey) {
      const match = rawLine.match(/^\s+([\w-]+):\s*(.*)$/);
      if (match) {
        frontmatter[currentMapKey] = frontmatter[currentMapKey] || {};
        frontmatter[currentMapKey][match[1]] = stripQuotes(match[2]);
      }
      continue;
    }
    const match = rawLine.match(/^([\w-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (value.trim() === "") {
      currentMapKey = key;
      frontmatter[key] = {};
    } else {
      currentMapKey = null;
      frontmatter[key] = stripQuotes(value.trim());
    }
  }

  return { frontmatter, body: bodyLines.join("\n"), bodyStartLine: closingIndex + 2 };
}

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: node validate-skill.mjs <path-to-SKILL.md>");
  }
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  const parentDirName = path.basename(path.dirname(resolvedPath));

  if (!frontmatter) {
    fail("No parseable YAML frontmatter found (expected `---` ... `---` at the top of the file).");
    return;
  }

  const { name, description, license, compatibility, metadata, "allowed-tools": allowedTools } =
    frontmatter;

  if (!name) {
    fail("Missing required `name` field.");
  } else {
    if (name.length > MAX_NAME_LENGTH) {
      fail(`\`name\` exceeds ${MAX_NAME_LENGTH} characters (${name.length}).`);
    }
    if (!NAME_PATTERN.test(name)) {
      fail(
        `\`name\` "${name}" must be lowercase letters, numbers, and hyphens only, ` +
          "with no leading/trailing/consecutive hyphens."
      );
    }
    if (name !== parentDirName) {
      warn(`\`name\` ("${name}") does not match the parent directory name ("${parentDirName}").`);
    }
  }

  if (!description || description.trim() === "") {
    fail("Missing or empty required `description` field.");
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fail(`\`description\` exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length}).`);
  }

  if (compatibility && compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    fail(`\`compatibility\` exceeds ${MAX_COMPATIBILITY_LENGTH} characters (${compatibility.length}).`);
  }

  if (!license) warn("No `license` field set (optional, but recommended for shared skills).");
  if (!metadata || Object.keys(metadata).length === 0) {
    warn("No `metadata` map set (optional; commonly used for `author`/`version`).");
  }
  if (!allowedTools) warn("No `allowed-tools` field set (optional, experimental).");

  const bodyLineCount = body.split(/\r?\n/).filter((line) => line.trim() !== "").length;
  if (bodyLineCount > RECOMMENDED_MAX_BODY_LINES) {
    warn(
      `Body has ~${bodyLineCount} non-empty lines, above the recommended ${RECOMMENDED_MAX_BODY_LINES}. ` +
        "Consider moving detail to references/."
    );
  }

  if (process.exitCode === 1) {
    console.error(`\n${filePath}: FAILED`);
  } else {
    console.log(`${filePath}: OK`);
  }
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
