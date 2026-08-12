import { describe, expect, it } from "vitest";
import {
  clampScrollbackLines,
  resolveCursorStyle,
  resolveDefaultProfileId,
  resolveParticleEffect,
  resolveTerminalFontFamily,
  resolveTerminalFontSize,
  ensureProfiles,
} from "@/lib/terminal/terminal-settings";

describe("terminal-settings helpers", () => {
  it("clamps scrollback", () => {
    expect(clampScrollbackLines(1)).toBe(100);
    expect(clampScrollbackLines(5000)).toBe(5000);
    expect(clampScrollbackLines(200000)).toBe(100000);
    expect(clampScrollbackLines(Number.NaN)).toBe(5000);
  });

  it("resolves cursor style", () => {
    expect(resolveCursorStyle("block")).toBe("block");
    expect(resolveCursorStyle("nope")).toBe("bar");
  });

  it("resolves particle effect", () => {
    expect(resolveParticleEffect("dust")).toBe("dust");
    expect(resolveParticleEffect("Constellation")).toBe("constellation");
    expect(resolveParticleEffect("orbs")).toBe("orbs");
    expect(resolveParticleEffect("sparkles")).toBe("dust");
    expect(resolveParticleEffect("")).toBe("dust");
  });

  it("injects builtin profiles when empty", () => {
    const profiles = ensureProfiles([]);
    expect(profiles.map((p) => p.id)).toEqual(["powershell", "cmd"]);
  });

  it("falls back defaultProfile", () => {
    const profiles = ensureProfiles([]);
    expect(resolveDefaultProfileId("missing", profiles)).toBe("powershell");
  });

  it("falls back terminal font to chrome font", () => {
    expect(resolveTerminalFontFamily(null, "Terminus")).toContain("Terminus");
    expect(resolveTerminalFontSize(null, 14)).toBe(14);
    expect(resolveTerminalFontSize(18, 14)).toBe(18);
  });
});
