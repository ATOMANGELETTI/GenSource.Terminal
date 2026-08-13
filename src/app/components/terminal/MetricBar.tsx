import type { MetricLoadLevel } from "../../lib/terminal/format-metrics";

type MetricBarProps = {
  percent: number | null;
  variant?: "compact" | "expanded";
  loadLevel?: MetricLoadLevel;
};

function clampPercent(percent: number | null): number {
  if (percent == null || !Number.isFinite(percent)) {
    return 0;
  }
  return Math.max(0, Math.min(100, percent));
}

export function MetricBar({
  percent,
  variant = "compact",
  loadLevel = "ok",
}: MetricBarProps) {
  const width = clampPercent(percent);

  return (
    <span
      className={`metric-bar metric-bar--${variant}`}
      data-load={loadLevel}
      aria-hidden="true"
    >
      <span className="metric-bar__fill" style={{ width: `${width}%` }} />
    </span>
  );
}
