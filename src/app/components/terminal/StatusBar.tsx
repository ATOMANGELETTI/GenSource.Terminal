import {
  ArrowDownIcon,
  ArrowUpIcon,
  CpuIcon,
  GpuIcon,
  MemoryIcon,
  PanelLeftIcon,
} from "../icons/MenuIcons";
import { useSystemMetrics } from "../../hooks/useSystemMetrics";
import {
  formatPercent,
  formatRamGiB,
  formatRate,
  metricLoadLevel,
  ramLoadPercent,
} from "../../lib/terminal/format-metrics";

interface StatusBarProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  shellName: string;
  cols: number;
  rows: number;
}

function MetricBar({ percent }: { percent: number | null }) {
  const width =
    percent == null || !Number.isFinite(percent)
      ? 0
      : Math.max(0, Math.min(100, percent));
  return (
    <span className="status-bar__metric-bar" aria-hidden="true">
      <span
        className="status-bar__metric-bar-fill"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

export default function StatusBar({
  panelOpen,
  onTogglePanel,
  shellName,
  cols,
  rows,
}: StatusBarProps) {
  const metrics = useSystemMetrics();

  const cpu = metrics?.cpuPercent ?? null;
  const gpu = metrics?.gpuPercent ?? null;
  const ramUsed = metrics?.ramUsedBytes;
  const ramTotal = metrics?.ramTotalBytes;
  const ramPct =
    ramUsed != null && ramTotal != null
      ? ramLoadPercent(ramUsed, ramTotal)
      : null;
  const netUp = metrics?.netUpBps ?? 0;
  const netDown = metrics?.netDownBps ?? 0;

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

      <div
        className="status-bar__metrics"
        data-testid="status-bar-metrics"
        aria-label="System metrics"
      >
        <span
          className="status-bar__metric"
          data-load={metricLoadLevel(cpu)}
          title="CPU"
        >
          <CpuIcon className="status-bar__metric-icon" aria-hidden="true" />
          <span className="status-bar__metric-label">CPU</span>
          <MetricBar percent={cpu} />
          <span className="status-bar__metric-value">{formatPercent(cpu)}</span>
        </span>

        <span
          className="status-bar__metric"
          data-load={metricLoadLevel(gpu)}
          title="GPU"
        >
          <GpuIcon className="status-bar__metric-icon" aria-hidden="true" />
          <span className="status-bar__metric-label">GPU</span>
          <MetricBar percent={gpu} />
          <span className="status-bar__metric-value">{formatPercent(gpu)}</span>
        </span>

        <span
          className="status-bar__metric"
          data-load={metricLoadLevel(ramPct)}
          title="RAM"
        >
          <MemoryIcon className="status-bar__metric-icon" aria-hidden="true" />
          <span className="status-bar__metric-label">RAM</span>
          <MetricBar percent={ramPct} />
          <span className="status-bar__metric-value">
            {ramUsed != null ? formatRamGiB(ramUsed) : "—"}
          </span>
        </span>

        <span className="status-bar__metric status-bar__metric--net" title="Network">
          <ArrowUpIcon className="status-bar__metric-icon" aria-hidden="true" />
          <span className="status-bar__metric-value">{formatRate(netUp)}</span>
          <ArrowDownIcon
            className="status-bar__metric-icon"
            aria-hidden="true"
          />
          <span className="status-bar__metric-value">{formatRate(netDown)}</span>
        </span>
      </div>

      <div className="status-bar__spacer" />
      <div className="status-bar__info" data-testid="status-bar-info">
        {shellName} · {cols}×{rows}
      </div>
    </footer>
  );
}
