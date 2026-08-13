import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("packaging excludes logging", () => {
  it("tauri.conf.json resources omit other/logging", () => {
    const conf = JSON.parse(
      readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
    ) as { bundle: { resources: Record<string, string> } };

    const sources = Object.keys(conf.bundle.resources);
    expect(sources.some((s) => s.includes("logging"))).toBe(false);
    expect(sources).toEqual(
      expect.arrayContaining([
        "../other/configs/",
        "../other/database/",
        "../other/documents/",
        "../other/screenshots/",
        "../other/utilities/",
      ]),
    );
  });

  it("package.js skips the logging directory when copying other/", () => {
    const source = readFileSync(
      path.join(root, "src/scripts/package.js"),
      "utf8",
    );
    expect(source).toMatch(/OTHER_BUNDLE_SKIP\s*=\s*new Set\(\["logging"\]\)/);
    expect(source).toMatch(/skipNames:\s*OTHER_BUNDLE_SKIP/);
  });
});

describe("path casing", () => {
  it("tracks the window page as lowercase window.tsx", () => {
    const dir = path.join(root, "src/app/pages/window");
    const names = readdirSync(dir);
    expect(names).toContain("window.tsx");
    expect(names).not.toContain("Window.tsx");
  });
});
