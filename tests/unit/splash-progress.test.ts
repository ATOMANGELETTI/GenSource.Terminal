import { describe, expect, it } from "vitest";

import {
  computeSplashProgress,
  easeInOut,
  isSplashReady,
  milestoneFloor,
  SPLASH_MIN_DURATION_MS,
} from "@/lib/splash-progress";

describe("easeInOut", () => {
  it("clamps and smoothsteps", () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(2)).toBe(1);
    expect(easeInOut(0.5)).toBe(0.5);
  });
});

describe("milestoneFloor", () => {
  it("sums known milestone weights and caps at 1", () => {
    expect(milestoneFloor(new Set())).toBe(0);
    expect(milestoneFloor(new Set(["settings"]))).toBeCloseTo(0.4);
    expect(milestoneFloor(new Set(["settings", "appinfo"]))).toBeCloseTo(0.7);
  });
});

describe("computeSplashProgress", () => {
  it("never goes backwards below the milestone floor", () => {
    const milestones = new Set<"settings" | "appinfo">(["settings", "appinfo"]);
    const early = computeSplashProgress({
      elapsedMs: 0,
      minDurationMs: SPLASH_MIN_DURATION_MS,
      milestones,
    });
    expect(early).toBeCloseTo(0.7);
  });

  it("reaches 1 after the minimum duration", () => {
    const milestones = new Set<"settings" | "appinfo">(["settings", "appinfo"]);
    const done = computeSplashProgress({
      elapsedMs: SPLASH_MIN_DURATION_MS,
      minDurationMs: SPLASH_MIN_DURATION_MS,
      milestones,
    });
    expect(done).toBe(1);
  });
});

describe("isSplashReady", () => {
  it("requires milestones and minimum duration", () => {
    const milestones = new Set<"settings" | "appinfo">(["settings"]);
    expect(
      isSplashReady({
        elapsedMs: SPLASH_MIN_DURATION_MS,
        milestones,
      }),
    ).toBe(false);

    milestones.add("appinfo");
    expect(
      isSplashReady({
        elapsedMs: SPLASH_MIN_DURATION_MS - 1,
        milestones,
      }),
    ).toBe(false);
    expect(
      isSplashReady({
        elapsedMs: SPLASH_MIN_DURATION_MS,
        milestones,
      }),
    ).toBe(true);
  });
});
