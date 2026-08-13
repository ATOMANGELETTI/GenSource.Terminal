export type StatusBarMetricMode = "usage" | "temp";

export const STATUS_BAR_METRIC_MODE_KEY = "gensource.statusBar.metricMode";

export function readStoredMetricMode(): StatusBarMetricMode {
  try {
    const raw = localStorage.getItem(STATUS_BAR_METRIC_MODE_KEY);
    if (raw === "usage" || raw === "temp") {
      return raw;
    }
  } catch {
    /* ignore quota / private mode */
  }
  return "usage";
}

export function writeStoredMetricMode(mode: StatusBarMetricMode): void {
  try {
    localStorage.setItem(STATUS_BAR_METRIC_MODE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}
