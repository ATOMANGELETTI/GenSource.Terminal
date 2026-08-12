import { describe, expect, it } from "vitest";

import {
  formatPercent,
  formatRamGiB,
  formatRate,
  metricLoadLevel,
  ramLoadPercent,
} from "@/lib/terminal/format-metrics";

describe("format-metrics", () => {
  it("formats percent integers and null as em dash", () => {
    expect(formatPercent(12.4)).toBe("12%");
    expect(formatPercent(12.6)).toBe("13%");
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
    expect(formatPercent(Number.NaN)).toBe("—");
  });

  it("formats RAM as GiB with one decimal", () => {
    expect(formatRamGiB(6.1 * 1024 ** 3)).toBe("6.1G");
    expect(formatRamGiB(0)).toBe("0.0G");
  });

  it("formats SI network rates", () => {
    expect(formatRate(12)).toBe("12B");
    expect(formatRate(340_000)).toBe("340K");
    expect(formatRate(1_200_000)).toBe("1.2M");
    expect(formatRate(12_000_000)).toBe("12M");
    expect(formatRate(1_500_000_000)).toBe("1.5G");
  });

  it("maps load bands for micro-bar colors", () => {
    expect(metricLoadLevel(50)).toBe("ok");
    expect(metricLoadLevel(80)).toBe("warn");
    expect(metricLoadLevel(95)).toBe("danger");
    expect(metricLoadLevel(null)).toBe("ok");
  });

  it("computes RAM load percent", () => {
    expect(ramLoadPercent(50, 100)).toBe(50);
    expect(ramLoadPercent(10, 0)).toBeNull();
  });
});
