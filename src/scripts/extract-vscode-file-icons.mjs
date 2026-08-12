/**
 * Extracts a curated subset of vscode-icons into a typed module so the app
 * never ships the full ~3.7MB @iconify-json/vscode-icons collection.
 *
 * Run: node src/scripts/extract-vscode-file-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = path.join(
  root,
  "node_modules/@iconify-json/vscode-icons/icons.json",
);
const outPath = path.join(
  root,
  "src/app/components/icons/vscode-file-icons-data.ts",
);

/** @type {string[]} */
const ICON_NAMES = [
  "default-file",
  "file-type-typescript",
  "file-type-reactts",
  "file-type-js",
  "file-type-reactjs",
  "file-type-jsconfig",
  "file-type-tsconfig",
  "file-type-python",
  "file-type-json",
  "file-type-json5",
  "file-type-markdown",
  "file-type-mdx",
  "file-type-rust",
  "file-type-css",
  "file-type-scss",
  "file-type-sass",
  "file-type-less",
  "file-type-html",
  "file-type-svg",
  "file-type-powershell",
  "file-type-bat",
  "file-type-shell",
  "file-type-image",
  "file-type-zip",
  "file-type-binary",
  "file-type-yaml",
  "file-type-xml",
  "file-type-toml",
  "file-type-ini",
  "file-type-go",
  "file-type-java",
  "file-type-c",
  "file-type-cpp",
  "file-type-csharp",
  "file-type-docker",
  "file-type-git",
  "file-type-vue",
  "file-type-svelte",
  "file-type-text",
  "file-type-excel",
  "file-type-word",
  "file-type-powerpoint",
  "file-type-lua",
  "file-type-php",
  "file-type-ruby",
  "file-type-swift",
  "file-type-kotlin",
  "file-type-sql",
  "file-type-graphql",
  "file-type-prisma",
  "file-type-vite",
  "file-type-webpack",
  "file-type-tailwind",
  "file-type-editorconfig",
  "file-type-npm",
  "file-type-node",
  "file-type-yarn",
  "file-type-pnpm",
  "file-type-cargo",
  "file-type-cmake",
  "file-type-gradle",
  "file-type-dartlang",
  "file-type-flutter",
  "file-type-pdf2",
  "file-type-audio",
  "file-type-video",
  "file-type-font",
  "file-type-log",
  "file-type-license",
  "file-type-dotenv",
  "file-type-protobuf",
  "file-type-r",
  "file-type-jupyter",
  "file-type-terraform",
  "file-type-nginx",
  "file-type-apache",
  "file-type-assembly",
  "file-type-haskell",
  "file-type-elixir",
  "file-type-erlang",
  "file-type-clojure",
  "file-type-scala",
  "file-type-zig",
  "file-type-nim",
  "file-type-solidity",
  "file-type-wasm",
  "file-type-blender",
  "file-type-photoshop",
  "file-type-ai2",
  "file-type-storybook",
  "file-type-jest",
  "file-type-vitest",
  "file-type-playwright",
  "file-type-cypress",
  "file-type-eslint",
  "file-type-prettier",
  "file-type-babel",
  "file-type-gulp",
  "file-type-grunt",
  "file-type-rollup",
  "file-type-esbuild",
  "file-type-bun",
  "file-type-deno",
  "file-type-tauri",
  "file-type-electron",
  "file-type-next",
  "file-type-nuxt",
  "file-type-astro",
  "file-type-angular",
  "file-type-ember",
  "file-type-coffeescript",
  "file-type-pug",
  "file-type-handlebars",
  "file-type-twig",
  "file-type-liquid",
  "file-type-jinja",
  "file-type-razor",
  "file-type-asp",
  "file-type-jsp",
  "file-type-vb",
  "file-type-fsharp",
  "file-type-ocaml",
  "file-type-fortran",
  "file-type-matlab",
  "file-type-sas",
  "file-type-stata",
  "file-type-diff",
  "file-type-patch",
  "file-type-sqlite",
  "file-type-mysql",
  "file-type-pgsql",
  "file-type-mongo",
  "file-type-http",
  "file-type-rest",
  "file-type-swagger",
  "file-type-postman",
  "file-type-key",
  "file-type-cert",
  "file-type-yarn",
  "file-type-bower",
  "file-type-composer",
  "file-type-pip",
  "file-type-poetry",
  "file-type-conda",
  "file-type-bundler",
  "file-type-maven",
  "file-type-sbt",
  "file-type-nuget",
  "file-type-paket",
  "file-type-cabal",
  "file-type-elm",
  "file-type-purescript",
  "file-type-reason",
  "file-type-rescript",
  "file-type-flow",
  "file-type-haxe",
  "file-type-actionscript",
  "file-type-flash",
  "file-type-tex",
  "file-type-asciidoc",
  "file-type-org",
  "file-type-todo",
  "file-type-sublime",
  "file-type-vscode",
  "file-type-jetbrains",
  "file-type-xcode",
  "file-type-godot",
  "file-type-gamemaker",
  "file-type-shaderlab",
  "file-type-hlsl",
  "file-type-glsl",
  "file-type-wgsl",
  "file-type-metal",
  "file-type-cuda",
  "file-type-opencl",
  "file-type-package",
  "file-type-go-package",
];

const collection = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const width = collection.width ?? 32;
const height = collection.height ?? 32;
/** @type {Record<string, { body: string; width?: number; height?: number }>} */
const icons = {};
const missing = [];

for (const name of ICON_NAMES) {
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
  console.warn("Missing icons (skipped):", missing.join(", "));
}

const banner = `/* Auto-generated by src/scripts/extract-vscode-file-icons.mjs — do not edit by hand. */
import type { IconifyIcon } from "@iconify/types";

export const VSCODE_ICON_WIDTH = ${width} as const;
export const VSCODE_ICON_HEIGHT = ${height} as const;

export const VSCODE_FILE_ICONS = ${JSON.stringify(icons, null, 2)} as const satisfies Record<
  string,
  Pick<IconifyIcon, "body" | "width" | "height">
>;
`;

fs.writeFileSync(outPath, banner);
console.log(
  `Wrote ${Object.keys(icons).length} icons → ${path.relative(root, outPath)}`,
);
