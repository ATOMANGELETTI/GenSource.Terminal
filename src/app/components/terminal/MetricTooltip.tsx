import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";

import {
  ArrowDownIcon,
  ArrowUpIcon,
} from "../icons/MenuIcons";
import {
  formatTempCelsius,
  formatRate,
  formatRateDetail,
  metricLoadLevel,
  tempBarPercent,
  tempLoadLevel,
  type MetricLoadLevel,
} from "../../lib/terminal/format-metrics";
import { MetricBar } from "./MetricBar";

const SHOW_DELAY_MS = 150;
const HIDE_DELAY_MS = 120;
const TOOLTIP_GAP_PX = 8;

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type PercentMetricTooltipProps = {
  kind?: "percent";
  label: string;
  Icon: IconComponent;
  percent: number | null;
  value: string;
  tooltipValue?: string;
  detail: string;
  className?: string;
};

type TemperatureMetricTooltipProps = {
  kind: "temperature";
  label: string;
  Icon: IconComponent;
  celsius: number | null;
  detail: string;
  className?: string;
};

type NetworkMetricTooltipProps = {
  kind: "network";
  netUp: number;
  netDown: number;
  className?: string;
};

type MetricTooltipProps =
  | PercentMetricTooltipProps
  | TemperatureMetricTooltipProps
  | NetworkMetricTooltipProps;

type TooltipPosition = {
  top: number;
  left: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function NetworkTooltipContent({
  netUp,
  netDown,
}: {
  netUp: number;
  netDown: number;
}) {
  const maxRate = Math.max(netUp, netDown, 1);
  const upPercent = (netUp / maxRate) * 100;
  const downPercent = (netDown / maxRate) * 100;

  return (
    <>
      <div className="metric-tooltip__header">
        <span className="metric-tooltip__header-name">
          <ArrowUpIcon className="metric-tooltip__header-icon" aria-hidden="true" />
          <ArrowDownIcon className="metric-tooltip__header-icon" aria-hidden="true" />
          Network
        </span>
      </div>
      <div className="metric-tooltip__net-rates">
        <div className="metric-tooltip__net-rate">
          <ArrowUpIcon className="metric-tooltip__net-icon" aria-hidden="true" />
          <span className="metric-tooltip__value">{formatRate(netUp)}</span>
        </div>
        <div className="metric-tooltip__net-rate">
          <ArrowDownIcon className="metric-tooltip__net-icon" aria-hidden="true" />
          <span className="metric-tooltip__value">{formatRate(netDown)}</span>
        </div>
      </div>
      <div className="metric-tooltip__net-bars" aria-hidden="true">
        <span className="metric-tooltip__net-bar metric-tooltip__net-bar--up">
          <span
            className="metric-tooltip__net-bar-fill"
            style={{ width: `${upPercent}%` }}
          />
        </span>
        <span className="metric-tooltip__net-bar metric-tooltip__net-bar--down">
          <span
            className="metric-tooltip__net-bar-fill"
            style={{ width: `${downPercent}%` }}
          />
        </span>
      </div>
      <p className="metric-tooltip__detail">
        ↑ {formatRateDetail(netUp)} · ↓ {formatRateDetail(netDown)}
      </p>
    </>
  );
}

function PercentTooltipContent({
  label,
  Icon,
  value,
  percent,
  loadLevel,
  detail,
}: {
  label: string;
  Icon: IconComponent;
  value: string;
  percent: number | null;
  loadLevel: MetricLoadLevel;
  detail: string;
}) {
  return (
    <>
      <div className="metric-tooltip__header">
        <span className="metric-tooltip__header-name">
          <Icon className="metric-tooltip__header-icon" aria-hidden="true" />
          {label}
        </span>
      </div>
      <p className="metric-tooltip__value">{value}</p>
      <div className="metric-tooltip__meter">
        <MetricBar percent={percent} variant="expanded" loadLevel={loadLevel} />
      </div>
      <p className="metric-tooltip__detail">{detail}</p>
    </>
  );
}

export function MetricTooltip(props: MetricTooltipProps) {
  const tooltipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;

    const centerX = anchorRect.left + anchorRect.width / 2;
    const unclampedLeft = centerX - tooltipRect.width / 2;
    const left = clamp(
      unclampedLeft,
      margin,
      window.innerWidth - tooltipRect.width - margin,
    );
    const top = anchorRect.top - tooltipRect.height - TOOLTIP_GAP_PX;

    setPosition({ top, left });
  }, []);

  const scheduleShow = useCallback(() => {
    clearHideTimer();
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, [clearHideTimer, clearShowTimer]);

  const scheduleHide = useCallback(() => {
    clearShowTimer();
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, HIDE_DELAY_MS);
  }, [clearHideTimer, clearShowTimer]);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    updatePosition();
  }, [visible, updatePosition, props]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const handleReposition = () => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [visible, updatePosition]);

  useEffect(
    () => () => {
      clearShowTimer();
      clearHideTimer();
    },
    [clearHideTimer, clearShowTimer],
  );

  const isNetwork = props.kind === "network";
  const isTemperature = props.kind === "temperature";

  const loadLevel: MetricLoadLevel = isNetwork
    ? "ok"
    : isTemperature
      ? tempLoadLevel(props.celsius)
      : metricLoadLevel(props.percent);

  const barPercent = isTemperature
    ? tempBarPercent(props.celsius)
    : isNetwork
      ? null
      : props.percent;

  const displayValue = isTemperature
    ? formatTempCelsius(props.celsius)
    : isNetwork
      ? null
      : props.value;

  const metricClassName = isNetwork
    ? "status-bar__metric status-bar__metric--net"
    : "status-bar__metric";

  const tooltipClassName = isNetwork
    ? "metric-tooltip metric-tooltip--net metric-tooltip-enter"
    : "metric-tooltip metric-tooltip-enter";

  const tooltipContent = isNetwork ? (
    <NetworkTooltipContent netUp={props.netUp} netDown={props.netDown} />
  ) : (
    <PercentTooltipContent
      label={props.label}
      Icon={props.Icon}
      value={
        isTemperature
          ? formatTempCelsius(props.celsius)
          : (props.tooltipValue ?? props.value)
      }
      percent={barPercent}
      loadLevel={loadLevel}
      detail={props.detail}
    />
  );

  return (
    <>
      <span
        ref={anchorRef}
        className={props.className ?? metricClassName}
        data-load={loadLevel}
        tabIndex={0}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        onFocus={scheduleShow}
        onBlur={scheduleHide}
      >
        {isNetwork ? (
          <>
            <ArrowUpIcon className="status-bar__metric-icon" aria-hidden="true" />
            <span className="status-bar__metric-value">
              {formatRate(props.netUp)}
            </span>
            <ArrowDownIcon className="status-bar__metric-icon" aria-hidden="true" />
            <span className="status-bar__metric-value">
              {formatRate(props.netDown)}
            </span>
          </>
        ) : (
          <>
            <props.Icon
              className="status-bar__metric-icon"
              aria-hidden="true"
            />
            <span className="status-bar__metric-label">{props.label}</span>
            <MetricBar
              percent={barPercent}
              variant="compact"
              loadLevel={loadLevel}
            />
            <span className="status-bar__metric-value">{displayValue}</span>
          </>
        )}
      </span>

      {visible &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={tooltipClassName}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
            }}
            onMouseEnter={scheduleShow}
            onMouseLeave={scheduleHide}
          >
            {tooltipContent}
            <span className="metric-tooltip__caret" aria-hidden="true" />
          </div>,
          document.body,
        )}
    </>
  );
}
