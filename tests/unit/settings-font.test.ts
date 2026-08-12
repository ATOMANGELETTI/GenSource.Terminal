import { describe, expect, it } from "vitest";

import {
  ALLOWED_FONT_FAMILIES,
  FONT_FAMILY_MAP,
  resolveFontFamily,
} from "@/lib/settings";

describe("resolveFontFamily", () => {
  it("maps known faces", () => {
    expect(resolveFontFamily("Terminus")).toBe(FONT_FAMILY_MAP.Terminus);
    expect(resolveFontFamily("Ubuntu")).toBe(FONT_FAMILY_MAP.Ubuntu);
    expect(resolveFontFamily("Fira Code")).toBe(FONT_FAMILY_MAP["Fira Code"]);
    expect(resolveFontFamily("Plus Jakarta Sans")).toBe(
      FONT_FAMILY_MAP["Plus Jakarta Sans"],
    );
  });

  it("falls back to Terminus for empty values", () => {
    expect(resolveFontFamily("")).toBe(FONT_FAMILY_MAP.Terminus);
    expect(resolveFontFamily("   ")).toBe(FONT_FAMILY_MAP.Terminus);
  });

  it("rejects unknown names instead of interpolating into CSS", () => {
    expect(resolveFontFamily("Comic Sans")).toBe(FONT_FAMILY_MAP.Terminus);
    expect(resolveFontFamily('"); url(https://evil.example)')).toBe(
      FONT_FAMILY_MAP.Terminus,
    );
  });

  it("exposes an allowlist matching FONT_FAMILY_MAP keys", () => {
    expect([...ALLOWED_FONT_FAMILIES].sort()).toEqual(
      Object.keys(FONT_FAMILY_MAP).sort(),
    );
  });
});
