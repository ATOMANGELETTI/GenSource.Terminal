/** Pure formatters for status-bar system metrics. */

const EM_DASH = "—";

/** Integer percent, or em dash when missing/non-finite. */
export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(Math.max(0, value))}%`;
}

/** Used RAM as GiB with one decimal (`6.1G`). */
export function formatRamGiB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return EM_DASH;
  }
  const gib = bytes / 1024 ** 3;
  return `${gib.toFixed(1)}G`;
}

/** Full RAM usage line for tooltip detail (`6.1 GB / 16.0 GB`). */
export function formatRamDetail(usedBytes: number, totalBytes: number): string {
  if (
    !Number.isFinite(usedBytes) ||
    !Number.isFinite(totalBytes) ||
    totalBytes <= 0
  ) {
    return EM_DASH;
  }
  const usedGib = usedBytes / 1024 ** 3;
  const totalGib = totalBytes / 1024 ** 3;
  return `${usedGib.toFixed(1)} GB / ${totalGib.toFixed(1)} GB`;
}

/** Full network rate with unit suffix (`340 KB/s`). */
export function formatRateDetail(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) {
    return "0 B/s";
  }
  if (bps < 1000) {
    return `${Math.round(bps)} B/s`;
  }
  if (bps < 1_000_000) {
    const v = bps / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)} KB/s`;
  }
  if (bps < 1_000_000_000) {
    const v = bps / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)} MB/s`;
  }
  const v = bps / 1_000_000_000;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)} GB/s`;
}

/**
 * SI network rate (`B` / `K` / `M` / `G` per second).
 * One decimal below 10 of the chosen unit; otherwise integer.
 */
export function formatRate(bps: number): string {
  if (!Number.isFinite(bps) || bps < 0) {
    return "0B";
  }
  if (bps < 1000) {
    return `${Math.round(bps)}B`;
  }
  if (bps < 1_000_000) {
    const v = bps / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)}K`;
  }
  if (bps < 1_000_000_000) {
    const v = bps / 1_000_000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1)}M`;
  }
  const v = bps / 1_000_000_000;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)}G`;
}

/** Load band for micro-bar color tokens. */
export type MetricLoadLevel = "ok" | "warn" | "danger";

export function metricLoadLevel(
  percent: number | null | undefined,
): MetricLoadLevel {
  if (percent == null || !Number.isFinite(percent)) {
    return "ok";
  }
  if (percent >= 95) {
    return "danger";
  }
  if (percent >= 80) {
    return "warn";
  }
  return "ok";
}

export function ramLoadPercent(used: number, total: number): number | null {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return Math.min(100, (used / total) * 100);
}

/** Integer °C, or em dash when missing/non-finite. */
export function formatTempCelsius(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return `${Math.round(value)}°C`;
}

/** Thermal bands for micro-bar color tokens. */
export function tempLoadLevel(
  celsius: number | null | undefined,
): MetricLoadLevel {
  if (celsius == null || !Number.isFinite(celsius)) {
    return "ok";
  }
  if (celsius >= 85) {
    return "danger";
  }
  if (celsius >= 70) {
    return "warn";
  }
  return "ok";
}

/** Map 0–100°C onto a 0–100 bar width. */
export function tempBarPercent(
  celsius: number | null | undefined,
): number | null {
  if (celsius == null || !Number.isFinite(celsius)) {
    return null;
  }
  return Math.max(0, Math.min(100, celsius));
}

/** Tooltip detail line for a temperature metric. */
export function formatTempDetail(
  label: string,
  celsius: number | null | undefined,
): string {
  if (celsius == null || !Number.isFinite(celsius)) {
    return "Unavailable";
  }
  return `${label} die temperature`;
}
