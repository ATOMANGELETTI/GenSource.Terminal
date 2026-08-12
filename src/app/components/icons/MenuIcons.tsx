import type { SVGProps } from "react";

/**
 * Flat, single-color line icons (16x16, `currentColor` strokes) used across
 * the titlebar, content-area, and tray context menus. No fills, gradients,
 * or shadows — kept intentionally simple to match the app's flat chrome.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function ReloadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.8V6h-3.2" />
    </svg>
  );
}

export function ZoomInIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M14 14l-3.2-3.2M7 5v4M5 7h4" />
    </svg>
  );
}

export function ZoomOutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M14 14l-3.2-3.2M5 7h4" />
    </svg>
  );
}

export function ZoomResetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M14 14l-3.2-3.2" />
      <circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
      <path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8" />
    </svg>
  );
}

export function PasteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3" width="9" height="11" rx="1.2" />
      <path d="M6 3V2.2a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8V3" />
      <path d="M6 8h4M6 10.5h4" />
    </svg>
  );
}

export function PreferencesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="1.9" />
      <path d="M8 2.5v1.4M8 12.1v1.4M13.5 8h-1.4M3.9 8H2.5M11.7 4.3l-1 1M5.3 10.7l-1 1M11.7 11.7l-1-1M5.3 5.3l-1-1" />
    </svg>
  );
}

export function AboutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.2v3.6" />
      <circle cx="8" cy="5.3" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function RestoreIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="3" width="7.5" height="7.5" rx="0.8" />
      <path d="M3.5 5.5v6.2a.8.8 0 0 0 .8.8h6.2" />
    </svg>
  );
}

export function MoveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5v11M2.5 8h11" />
      <path d="M8 2.5 6.3 4.2M8 2.5l1.7 1.7M8 13.5l-1.7-1.7M8 13.5l1.7-1.7M2.5 8l1.7-1.7M2.5 8l1.7 1.7M13.5 8l-1.7-1.7M13.5 8l-1.7 1.7" />
    </svg>
  );
}

export function ResizeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.8" />
      <path d="M9 13h4V9" />
    </svg>
  );
}

export function MinimizeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function MaximizeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="10" height="10" rx="0.8" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function HideIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 8.5S4.8 4.5 8 4.5s5.5 4 5.5 4-2.3 4-5.5 4-5.5-4-5.5-4z" />
      <path d="M2.5 2.5l11 11" />
    </svg>
  );
}

export function ShowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 8.5S4.8 4.5 8 4.5s5.5 4 5.5 4-2.3 4-5.5 4-5.5-4-5.5-4z" />
      <circle cx="8" cy="8.5" r="1.6" />
    </svg>
  );
}

export function CheckUpdatesIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13 2.8V6h-3.2" />
      <path d="M6.2 8.3l1.3 1.3 2.4-2.6" />
    </svg>
  );
}

export function QuitIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.6 2.8H4.2a1.2 1.2 0 0 0-1.2 1.2v8a1.2 1.2 0 0 0 1.2 1.2h2.4" />
      <path d="M10.2 5.3 13 8l-2.8 2.7M13 8H6.2" />
    </svg>
  );
}
