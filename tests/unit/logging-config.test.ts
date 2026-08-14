import { describe, expect, it } from "vitest";

import {
  allows,
  anyLevelEnabled,
  classifyLine,
  consumeLogChunk,
} from "../../src/scripts/logging-config.js";

describe("classifyLine", () => {
  it("reads plugin-style level tags", () => {
    expect(classifyLine("[2026-08-13][18:10:00][ERROR][app_lib] boom")).toBe(
      "error",
    );
    expect(classifyLine("[WARN] slow path")).toBe("warn");
    expect(classifyLine("[DEBUG] detail")).toBe("debug");
    expect(classifyLine("[FATAL] exit")).toBe("fatal");
  });

  it("reads cargo rustc prefixes", () => {
    expect(classifyLine("error: could not compile `foo`")).toBe("error");
    expect(classifyLine("error[E0425]: cannot find value")).toBe("error");
    expect(classifyLine("warning: unused variable")).toBe("warn");
  });

  it("defaults unmatched transcript lines to info", () => {
    expect(classifyLine("   Compiling foo v1.0.0")).toBe("info");
  });
});

describe("allows / anyLevelEnabled", () => {
  const section = {
    error: true,
    warn: true,
    info: false,
    debug: false,
    trace: false,
    fatal: true,
  };

  it("honors per-level toggles", () => {
    expect(allows(section, "error")).toBe(true);
    expect(allows(section, "info")).toBe(false);
  });

  it("reports whether any level is on", () => {
    expect(anyLevelEnabled(section)).toBe(true);
    expect(
      anyLevelEnabled({
        error: false,
        warn: false,
        info: false,
        debug: false,
        trace: false,
        fatal: false,
      }),
    ).toBe(false);
  });
});

describe("consumeLogChunk", () => {
  it("keeps an incomplete tail and classifies complete lines", () => {
    const seen: { line: string; level: string }[] = [];
    const carry = consumeLogChunk("", "error: one\nCompiling", (line: string, level: string) => {
      seen.push({ line, level });
    });
    expect(carry).toBe("Compiling");
    expect(seen).toEqual([{ line: "error: one", level: "error" }]);
  });
});
