import { describe, expect, it } from "vitest";

import {
  isE2eMode,
  readWindowQueryParam,
  resolveWindowLabel,
} from "@/lib/e2e-window";

describe("readWindowQueryParam", () => {
  it("parses known window labels", () => {
    expect(readWindowQueryParam("?window=splash")).toBe("splash");
    expect(readWindowQueryParam("?window=tray-menu")).toBe("tray-menu");
    expect(readWindowQueryParam("?window=main")).toBe("main");
  });

  it("rejects unknown labels", () => {
    expect(readWindowQueryParam("?window=other")).toBeNull();
    expect(readWindowQueryParam("")).toBeNull();
  });
});

describe("isE2eMode", () => {
  it("accepts 1 or true", () => {
    expect(isE2eMode("?e2e=1")).toBe(true);
    expect(isE2eMode("?e2e=true")).toBe(true);
    expect(isE2eMode("?e2e=0")).toBe(false);
    expect(isE2eMode("")).toBe(false);
  });
});

describe("resolveWindowLabel", () => {
  it("prefers the query override when present", () => {
    const original = window.location.search;
    const url = new URL(window.location.href);
    url.search = "?window=splash&e2e=1";
    window.history.pushState({}, "", url);

    expect(resolveWindowLabel()).toBe("splash");

    url.search = original;
    window.history.pushState({}, "", url);
  });
});
