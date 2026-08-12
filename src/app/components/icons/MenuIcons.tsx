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

export function NewTabIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" />
      <path d="M8 6.2v3.6M6.2 8h3.6" />
    </svg>
  );
}

export function CloseTabIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" />
      <path d="M6 6.5l4 4M10 6.5l-4 4" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 12.5V9.2" />
      <path d="M5.2 9.2h5.6" />
      <path d="M6 9.2 6.8 4.8h2.4L10 9.2" />
      <circle cx="8" cy="3.6" r="0.9" />
    </svg>
  );
}

export function FindIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M14 14l-3.2-3.2" />
    </svg>
  );
}

export function ClearIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 4.5h9" />
      <path d="M5.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <path d="M6 7v5M8 7v5M10 7v5" />
      <path d="M4.5 4.5l.7 8.2a1 1 0 0 0 1 .8h3.6a1 1 0 0 0 1-.8l.7-8.2" />
    </svg>
  );
}

export function RenameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12.5h9" />
      <path d="M10.2 3.2l2.1 2.1L6.8 10.8H4.7V8.7z" />
    </svg>
  );
}

export function PanelLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="2.5" width="11" height="11" rx="0.8" />
      <path d="M6.5 2.5v11" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.2V12a1.2 1.2 0 0 0 1.2 1.2h8.6A1.2 1.2 0 0 0 13.5 12V6.4A1.2 1.2 0 0 0 12.3 5.2H8L6.7 3.8H3.7A1.2 1.2 0 0 0 2.5 5z" />
    </svg>
  );
}

export function NewFileIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M6 9h4M8 7v4" />
    </svg>
  );
}

export function NewFolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.2V12a1.2 1.2 0 0 0 1.2 1.2h8.6A1.2 1.2 0 0 0 13.5 12V6.4A1.2 1.2 0 0 0 12.3 5.2H8L6.7 3.8H3.7A1.2 1.2 0 0 0 2.5 5z" />
      <path d="M8 8v3.2M6.4 9.6h3.2" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

export function DriveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4" width="11" height="7.5" rx="1.2" />
      <path d="M4.5 11.5v1M11.5 11.5v1" />
      <circle cx="5.2" cy="7.8" r="0.7" fill="currentColor" stroke="none" />
      <path d="M7.5 7.8h4" />
    </svg>
  );
}

export function OpenExternalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 3.5H3.7A1.2 1.2 0 0 0 2.5 4.7v7.6A1.2 1.2 0 0 0 3.7 13.5h7.6a1.2 1.2 0 0 0 1.2-1.2V9.5" />
      <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5" />
    </svg>
  );
}

export function RevealIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.2V12a1.2 1.2 0 0 0 1.2 1.2h8.6A1.2 1.2 0 0 0 13.5 12V6.4A1.2 1.2 0 0 0 12.3 5.2H8L6.7 3.8H3.7A1.2 1.2 0 0 0 2.5 5z" />
      <circle cx="8.5" cy="9" r="2" />
      <path d="M10 10.5 12 12.5" />
    </svg>
  );
}

export function DeleteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 4.5h9" />
      <path d="M5.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <path d="M6 7v5M8 7v5M10 7v5" />
      <path d="M4.5 4.5l.7 8.2a1 1 0 0 0 1 .8h3.6a1 1 0 0 0 1-.8l.7-8.2" />
    </svg>
  );
}

export function FileGenericIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
    </svg>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="0.8" />
      <path d="M6.5 6.5h3v3h-3z" />
      <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.2 4.2l1.2 1.2M10.6 10.6l1.2 1.2M11.8 4.2l-1.2 1.2M5.4 10.6l-1.2 1.2" />
    </svg>
  );
}

export function GpuIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="4.5" width="11" height="7" rx="1" />
      <circle cx="8" cy="8" r="1.6" />
      <path d="M5 4.5V3.5M8 4.5V3.2M11 4.5V3.5M5 11.5v1M8 11.5v1.3M11 11.5v1" />
    </svg>
  );
}

export function MemoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="11" height="6" rx="0.8" />
      <path d="M5 5v6M8 5v6M11 5v6" />
      <path d="M4 11v1.5M7 11v1.5M10 11v1.5M13 11v1.5" />
    </svg>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7" />
    </svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
    </svg>
  );
}
