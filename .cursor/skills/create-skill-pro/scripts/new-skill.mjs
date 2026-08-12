#!/usr/bin/env node
/**
 * Scaffold a new skill under .cursor/skills/<name>/ from
 * assets/skill-template.md.
 *
 * Usage:
 *   node new-skill.mjs <name> [--description "..."] [--title "..."]
 *
 * Example:
 *   node .cursor/skills/create-skill-pro/scripts/new-skill.mjs add-tauri-command \
 *     --description "Add a new Tauri command handler. Use when asked to add or expose a Tauri command." \
 *     --title "Add a Tauri Command"
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const SUBFOLDERS = ["references", "scripts", "assets", "examples", "resources"];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const createSkillProDir = path.dirname(scriptDir);
const skillsDir = path.dirname(createSkillProDir);
const templatePath = path.join(createSkillProDir, "assets", "skill-template.md");

function parseArgs(argv) {
  const [name, ...rest] = argv;
  const result = { name, description: "", title: "" };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if ((arg === "--description" || arg === "-d") && rest[i + 1]) {
      result.description = rest[i + 1];
      i += 1;
    } else if (arg === "--title" && rest[i + 1]) {
      result.title = rest[i + 1];
      i += 1;
    }
  }
  return result;
}

function titleCase(name) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function validateName(name) {
  if (!name) {
    throw new Error("Skill name is required, e.g. `node new-skill.mjs my-skill`.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`Name exceeds ${MAX_NAME_LENGTH} characters: "${name}" (${name.length} chars).`);
  }
  if (!NAME_PATTERN.test(name)) {
    throw new Error(
      `Name "${name}" must be lowercase letters, numbers, and hyphens only, ` +
        "with no leading/trailing/consecutive hyphens (per the agentskills.io spec)."
    );
  }
}

function main() {
  const { name, description, title } = parseArgs(process.argv.slice(2));
  validateName(name);

  const skillDir = path.join(skillsDir, name);
  if (fs.existsSync(skillDir)) {
    throw new Error(`.cursor/skills/${name}/ already exists.`);
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const finalDescription =
    description || "TODO: describe what this skill does and when to use it (1-1024 chars).";
  const finalTitle = title || titleCase(name);

  const skillMd = template
    .replaceAll("{{NAME}}", name)
    .replaceAll("{{DESCRIPTION}}", finalDescription)
    .replaceAll("{{TITLE}}", finalTitle);

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf8");
  for (const folder of SUBFOLDERS) {
    fs.mkdirSync(path.join(skillDir, folder), { recursive: true });
  }

  console.log(`Created .cursor/skills/${name}/SKILL.md`);
  console.log(`Scaffolded empty subfolders: ${SUBFOLDERS.join(", ")}`);
  console.log(
    "Next: fill in the description if it's still a TODO, write the body, " +
      "then delete any subfolders you don't end up using " +
      "(see ../resources/quality-checklist.md) before validating with validate-skill.mjs."
  );
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
