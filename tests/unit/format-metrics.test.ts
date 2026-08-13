import { describe, expect, it } from "vitest";

import {
  formatPercent,
  formatRamDetail,
  formatRamGiB,
  formatRate,
  formatTempCelsius,
  formatTempDetail,
  metricLoadLevel,
  ramLoadPercent,
  tempBarPercent,
  tempLoadLevel,
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

  it("formats RAM detail for tooltips", () => {
    expect(formatRamDetail(6.1 * 1024 ** 3, 16 * 1024 ** 3)).toBe(
      "6.1 GB / 16.0 GB",
    );
    expect(formatRamDetail(0, 16 * 1024 ** 3)).toBe("0.0 GB / 16.0 GB");
    expect(formatRamDetail(10, 0)).toBe("—");
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

  it("formats Celsius integers and null as em dash", () => {
    expect(formatTempCelsius(42.4)).toBe("42°C");
    expect(formatTempCelsius(42.6)).toBe("43°C");
    expect(formatTempCelsius(null)).toBe("—");
    expect(formatTempCelsius(undefined)).toBe("—");
    expect(formatTempCelsius(Number.NaN)).toBe("—");
  });

  it("maps thermal bands for micro-bar colors", () => {
    expect(tempLoadLevel(50)).toBe("ok");
    expect(tempLoadLevel(69.9)).toBe("ok");
    expect(tempLoadLevel(70)).toBe("warn");
    expect(tempLoadLevel(84.9)).toBe("warn");
    expect(tempLoadLevel(85)).toBe("danger");
    expect(tempLoadLevel(null)).toBe("ok");
  });

  it("maps 0–100°C onto bar percent", () => {
    expect(tempBarPercent(0)).toBe(0);
    expect(tempBarPercent(42)).toBe(42);
    expect(tempBarPercent(100)).toBe(100);
    expect(tempBarPercent(120)).toBe(100);
    expect(tempBarPercent(-5)).toBe(0);
    expect(tempBarPercent(null)).toBeNull();
  });

  it("formats temperature tooltip detail", () => {
    expect(formatTempDetail("CPU", 42)).toBe("CPU die temperature");
    expect(formatTempDetail("GPU", null)).toBe("Unavailable");
    expect(formatTempDetail("RAM", Number.NaN)).toBe("Unavailable");
  });
});
