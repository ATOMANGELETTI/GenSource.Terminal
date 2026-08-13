/**
 * Extracts a curated subset of Material / Catppuccin icons into typed modules
 * so the app never ships full @iconify-json collections.
 *
 * Run: npm run icons:extract
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getCatppuccinFileIcon,
  getCatppuccinFolderIcon,
  getMaterialFileIcon,
  getMaterialFolderIcon,
} from "vscode-icon-resolver";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @typedef {'material' | 'catppuccin'} IconSetId */

/** @type {Record<IconSetId, string>} */
const SOURCE_PACKAGES = {
  material: "@iconify-json/material-icon-theme",
  catppuccin: "@iconify-json/catppuccin",
};

const SAMPLE_FILES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.vue",
  "index.svelte",
  "index.html",
  "index.css",
  "index.scss",
  "index.rs",
  "index.py",
  "index.go",
  "index.java",
  "index.php",
  "index.rb",
  "index.swift",
  "index.kt",
  "index.cs",
  "index.cpp",
  "index.c",
  "index.lua",
  "index.sql",
  "index.md",
  "index.mdx",
  "index.json",
  "index.yaml",
  "index.yml",
  "index.toml",
  "index.xml",
  "index.svg",
  "index.png",
  "index.jpg",
  "index.gif",
  "index.webp",
  "index.zip",
  "index.wasm",
  "index.ps1",
  "index.sh",
  "index.bat",
  "index.cmd",
  "Dockerfile",
  "docker-compose.yml",
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  "tailwind.config.ts",
  "webpack.config.js",
  "rollup.config.js",
  "eslint.config.js",
  ".eslintrc.json",
  ".prettierrc",
  "prettier.config.js",
  "babel.config.js",
  "astro.config.mjs",
  "next.config.ts",
  "nuxt.config.ts",
  "angular.json",
  "schema.prisma",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "pyproject.toml",
  "requirements.txt",
  "Gemfile",
  "Makefile",
  "CMakeLists.txt",
  "tauri.conf.json",
  "playwright.config.ts",
  "jest.config.js",
  "cypress.config.ts",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".env",
  ".env.local",
  ".env.example",
  "LICENSE",
  "README.md",
  "unknown.xyz",
];

const SAMPLE_FOLDERS = [
  "src",
  "dist",
  "node_modules",
  ".git",
  "components",
  "assets",
  "public",
  "tests",
  "docs",
  "config",
  "scripts",
  "random",
];

/**
 * @param {IconSetId} setId
 * @param {string} raw
 * @param {{ isFolder?: boolean; expanded?: boolean }} ctx
 */
function normalizeIconName(setId, raw, ctx = {}) {
  const { isFolder = false, expanded = false } = ctx;

  if (setId === "material") {
    if (raw === "default_file") return "document";
    if (raw === "default_folder") return expanded ? "folder-base-open" : "folder-base";
    if (raw === "default_root_folder") return "folder-base-open";
    let slug = raw.replace(/_/g, "-");
    if (isFolder && expanded && !slug.endsWith("-open")) {
      slug = `${slug}-open`;
    }
    return slug;
  }

  if (raw === "_file") return "file";
  if (raw === "_folder") return expanded ? "folder-open" : "folder";

  let slug = raw.replace(/_/g, "-");
  if (isFolder && !slug.startsWith("folder-")) {
    slug = `folder-${slug}`;
  }
  if (isFolder && expanded && !slug.endsWith("-open")) {
    slug = `${slug}-open`;
  }
  return slug;
}

/** @param {IconSetId} setId */
function collectIconNames(setId) {
  /** @type {Set<string>} */
  const names = new Set();

  for (const file of SAMPLE_FILES) {
    const raw =
      setId === "material"
        ? getMaterialFileIcon(file)
        : getCatppuccinFileIcon(file);
    names.add(normalizeIconName(setId, raw, { isFolder: false }));
  }

  for (const folder of SAMPLE_FOLDERS) {
    const closedRaw =
      setId === "material"
        ? getMaterialFolderIcon(folder, false)
        : getCatppuccinFolderIcon(folder);
    const openRaw =
      setId === "material"
        ? getMaterialFolderIcon(folder, true)
        : getCatppuccinFolderIcon(folder);

    names.add(normalizeIconName(setId, closedRaw, { isFolder: true, expanded: false }));
    names.add(normalizeIconName(setId, openRaw, { isFolder: true, expanded: true }));
  }

  if (setId === "material") {
    names.add("document");
    names.add("folder-base");
    names.add("folder-base-open");
    names.add("database");
  } else {
    names.add("file");
    names.add("folder");
    names.add("folder-open");
  }

  return [...names].sort();
}

/** @param {IconSetId} setId */
function extractSet(setId) {
  const pkg = SOURCE_PACKAGES[setId];
  const sourcePath = path.join(root, "node_modules", pkg, "icons.json");
  const outPath = path.join(
    root,
    "src/app/components/icons/fileIconSets",
    setId,
    "icons-data.ts",
  );

  const iconNames = collectIconNames(setId);
  const collection = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const width = collection.width ?? 32;
  const height = collection.height ?? 32;
  /** @type {Record<string, { body: string; width?: number; height?: number }>} */
  const icons = {};
  /** @type {string[]} */
  const missing = [];

  for (const name of iconNames) {
    const data = collection.icons[name];
    if (!data) {
      missing.push(name);
      continue;
    }
    icons[name] = {
      body: data.body,
      ...(data.width != null ? { width: data.width } : {}),
      ...(data.height != null ? { height: data.height } : {}),
    };
  }

  if (missing.length) {
    console.warn(`[${setId}] Missing icons (skipped):`, missing.join(", "));
  }

  const banner = `/* Auto-generated by src/scripts/extract-file-icons.mjs — do not edit by hand. */
import type { IconifyIcon } from "@iconify/types";

export const ICON_WIDTH = ${width} as const;
export const ICON_HEIGHT = ${height} as const;

export const FILE_ICON_DATA = ${JSON.stringify(icons, null, 2)} as const satisfies Record<
  string,
  Pick<IconifyIcon, "body" | "width" | "height">
>;
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, banner);
  console.log(
    `[${setId}] Wrote ${Object.keys(icons).length} icons → ${path.relative(root, outPath)}`,
  );
}

const setArg = process.argv.find((arg) => arg.startsWith("--set="));
const setId = setArg?.split("=")[1];

if (setId === "material" || setId === "catppuccin") {
  extractSet(setId);
} else {
  extractSet("material");
  extractSet("catppuccin");
}
