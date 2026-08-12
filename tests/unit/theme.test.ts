import { afterEach, describe, expect, it, vi } from "vitest";

import { followsSystemScheme, resolveTheme } from "@/lib/theme";

function mockPrefersColorScheme(dark: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: dark && query.includes("prefers-color-scheme: dark"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("keeps fixed polar-night and snow-storm ids", () => {
    mockPrefersColorScheme(false);
    expect(resolveTheme("nord-polar-night")).toBe("nord-polar-night");
    expect(resolveTheme("polar-night")).toBe("nord-polar-night");
    expect(resolveTheme("nord-snow-storm")).toBe("nord-snow-storm");
    expect(resolveTheme("snow-storm")).toBe("nord-snow-storm");
  });

  it("falls back to nord-polar-night for unrecognized values", () => {
    expect(resolveTheme("not-a-theme")).toBe("nord-polar-night");
    expect(resolveTheme("")).toBe("nord-polar-night");
  });

  it('maps "system" to polar-night when OS prefers dark', () => {
    mockPrefersColorScheme(true);
    expect(resolveTheme("system")).toBe("nord-polar-night");
  });

  it('maps "system" to snow-storm when OS prefers light', () => {
    mockPrefersColorScheme(false);
    expect(resolveTheme("system")).toBe("nord-snow-storm");
  });

  it("maps frost to dark frost when OS prefers dark", () => {
    mockPrefersColorScheme(true);
    expect(resolveTheme("frost")).toBe("nord-frost");
    expect(resolveTheme("nord-frost")).toBe("nord-frost");
  });

  it("maps frost to light frost when OS prefers light", () => {
    mockPrefersColorScheme(false);
    expect(resolveTheme("frost")).toBe("nord-frost-light");
    expect(resolveTheme("nord-frost")).toBe("nord-frost-light");
  });

  it("maps aurora to dark aurora when OS prefers dark", () => {
    mockPrefersColorScheme(true);
    expect(resolveTheme("aurora")).toBe("nord-aurora");
    expect(resolveTheme("nord-aurora")).toBe("nord-aurora");
  });

  it("maps aurora to light aurora when OS prefers light", () => {
    mockPrefersColorScheme(false);
    expect(resolveTheme("aurora")).toBe("nord-aurora-light");
    expect(resolveTheme("nord-aurora")).toBe("nord-aurora-light");
  });

  it("allows locking frost/aurora to an explicit light or dark variant", () => {
    mockPrefersColorScheme(true);
    expect(resolveTheme("frost-light")).toBe("nord-frost-light");
    expect(resolveTheme("aurora-light")).toBe("nord-aurora-light");
    mockPrefersColorScheme(false);
    expect(resolveTheme("frost-dark")).toBe("nord-frost");
    expect(resolveTheme("aurora-dark")).toBe("nord-aurora");
  });
});

describe("followsSystemScheme", () => {
  it("is true for system, frost, and aurora preferences", () => {
    expect(followsSystemScheme("system")).toBe(true);
    expect(followsSystemScheme("frost")).toBe(true);
    expect(followsSystemScheme("nord-frost")).toBe(true);
    expect(followsSystemScheme("aurora")).toBe(true);
    expect(followsSystemScheme("nord-aurora")).toBe(true);
  });

  it("is false for fixed themes and locked variants", () => {
    expect(followsSystemScheme("nord-polar-night")).toBe(false);
    expect(followsSystemScheme("nord-snow-storm")).toBe(false);
    expect(followsSystemScheme("frost-light")).toBe(false);
    expect(followsSystemScheme("aurora-dark")).toBe(false);
  });
});
