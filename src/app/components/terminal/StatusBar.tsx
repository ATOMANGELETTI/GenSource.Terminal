import { useState } from "react";

import {
  CpuIcon,
  GaugeIcon,
  GpuIcon,
  MemoryIcon,
  PanelLeftIcon,
  ThermometerIcon,
} from "../icons/MenuIcons";
import { useSystemMetrics } from "../../hooks/useSystemMetrics";
import {
  formatPercent,
  formatRamDetail,
  formatRamGiB,
  formatTempDetail,
  ramLoadPercent,
} from "../../lib/terminal/format-metrics";
import {
  readStoredMetricMode,
  writeStoredMetricMode,
  type StatusBarMetricMode,
} from "../../lib/terminal/status-bar-mode";
import { MetricTooltip } from "./MetricTooltip";

interface StatusBarProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  shellName: string;
  cols: number;
  rows: number;
}

export default function StatusBar({
  panelOpen,
  onTogglePanel,
  shellName,
  cols,
  rows,
}: StatusBarProps) {
  const metrics = useSystemMetrics();
  const [metricMode, setMetricMode] = useState<StatusBarMetricMode>(() =>
    readStoredMetricMode(),
  );

  const cpu = metrics?.cpuPercent ?? null;
  const gpu = metrics?.gpuPercent ?? null;
  const ramUsed = metrics?.ramUsedBytes;
  const ramTotal = metrics?.ramTotalBytes;
  const ramPct =
    ramUsed != null && ramTotal != null
      ? ramLoadPercent(ramUsed, ramTotal)
      : null;
  const cpuTemp = metrics?.cpuTempCelsius ?? null;
  const gpuTemp = metrics?.gpuTempCelsius ?? null;
  const ramTemp = metrics?.ramTempCelsius ?? null;
  const netUp = metrics?.netUpBps ?? 0;
  const netDown = metrics?.netDownBps ?? 0;

  const gpuDetail =
    gpu == null || !Number.isFinite(gpu)
      ? "Unavailable"
      : "GPU utilization";

  const toggleMetricMode = () => {
    setMetricMode((prev) => {
      const next: StatusBarMetricMode = prev === "usage" ? "temp" : "usage";
      writeStoredMetricMode(next);
      return next;
    });
  };

  return (
    <footer className="status-bar" data-testid="status-bar">
      <button
        type="button"
        className="status-bar__toggle"
        aria-pressed={panelOpen}
        aria-label="Toggle side panel"
        data-testid="status-bar-panel-toggle"
        onClick={onTogglePanel}
      >
        <PanelLeftIcon className="status-bar__toggle-icon" aria-hidden="true" />
      </button>

      <div className="status-bar__spacer" />

      <div className="status-bar__info" data-testid="status-bar-info">
        {shellName} · {cols}×{rows}
      </div>

      <div
        key={metricMode}
        className="status-bar__metrics status-bar__metrics-swap"
        data-testid="status-bar-metrics"
        aria-label="System metrics"
      >
        {metricMode === "usage" ? (
          <>
            <MetricTooltip
              label="CPU"
              Icon={CpuIcon}
              percent={cpu}
              value={formatPercent(cpu)}
              detail="System processor usage"
            />

            <MetricTooltip
              label="GPU"
              Icon={GpuIcon}
              percent={gpu}
              value={formatPercent(gpu)}
              detail={gpuDetail}
            />

            <MetricTooltip
              label="RAM"
              Icon={MemoryIcon}
              percent={ramPct}
              value={ramUsed != null ? formatRamGiB(ramUsed) : "—"}
              tooltipValue={formatPercent(ramPct)}
              detail={
                ramUsed != null && ramTotal != null
                  ? formatRamDetail(ramUsed, ramTotal)
                  : "—"
              }
            />
          </>
        ) : (
          <>
            <MetricTooltip
              kind="temperature"
              label="CPU"
              Icon={CpuIcon}
              celsius={cpuTemp}
              detail={formatTempDetail("CPU", cpuTemp)}
            />

            <MetricTooltip
              kind="temperature"
              label="GPU"
              Icon={GpuIcon}
              celsius={gpuTemp}
              detail={formatTempDetail("GPU", gpuTemp)}
            />

            <MetricTooltip
              kind="temperature"
              label="RAM"
              Icon={MemoryIcon}
              celsius={ramTemp}
              detail={formatTempDetail("RAM", ramTemp)}
            />
          </>
        )}

        <MetricTooltip kind="network" netUp={netUp} netDown={netDown} />
      </div>

      <button
        type="button"
        className="status-bar__mode-toggle"
        aria-pressed={metricMode === "temp"}
        aria-label={
          metricMode === "usage" ? "Show temperatures" : "Show usage"
        }
        data-testid="status-bar-mode-toggle"
        onClick={toggleMetricMode}
      >
        {metricMode === "usage" ? (
          <ThermometerIcon
            className="status-bar__mode-toggle-icon"
            aria-hidden="true"
          />
        ) : (
          <GaugeIcon
            className="status-bar__mode-toggle-icon"
            aria-hidden="true"
          />
        )}
      </button>
    </footer>
  );
}
