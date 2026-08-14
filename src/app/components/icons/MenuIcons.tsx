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

/** Flat sun/palette glyph for Config → Appearance. */
export function AppearanceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 2.2v1.4M8 12.4v1.4M13.8 8h-1.4M3.6 8H2.2M12.1 3.9l-1 1M4.9 11.1l-1 1M12.1 12.1l-1-1M4.9 4.9l-1-1" />
    </svg>
  );
}

/** Flat window glyph for Config → Window. */
export function WindowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
      <path d="M2.5 6.2h11" />
    </svg>
  );
}

/** Flat prompt/chevron glyph for Config → Terminal. */
export function TerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="1.2" />
      <path d="M5 6.2l2 1.8-2 1.8M8.2 10.2H11" />
    </svg>
  );
}

/** Flat log-lines glyph for Config → Logging. */
export function LoggingIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 3.5h9v9h-9z" />
      <path d="M5.5 6h5M5.5 8h5M5.5 10h3" />
    </svg>
  );
}

/** Flat keyboard glyph for Config → Keyboard. */
export function KeyboardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="4.5" width="12" height="7" rx="1.2" />
      <path d="M4.2 6.8h1.2M6.4 6.8h1.2M8.6 6.8h1.2M10.8 6.8h1M4.2 9h7.6" />
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

/** Flat bot / agent glyph for the Agents side-panel tab. */
export function BotIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="9" height="7" rx="1.5" />
      <path d="M8 2.5v3" />
      <circle cx="8" cy="2.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M5.8 8.2h.1M10.2 8.2h.1" />
      <path d="M6.2 10.2h3.6" />
      <path d="M3.5 8.2H2.2M12.5 8.2h1.3" />
    </svg>
  );
}

/** Speech-bubble glyph for Agents → Chat. */
export function ChatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 3.8h9.6a1.2 1.2 0 0 1 1.2 1.2v5.2a1.2 1.2 0 0 1-1.2 1.2H6.4L3.2 13.8V5a1.2 1.2 0 0 1 1.2-1.2z" />
    </svg>
  );
}

/** Clock glyph for Agents → Previous chats. */
export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.4" />
      <path d="M8 5.2V8l2.1 1.4" />
    </svg>
  );
}

/** Hierarchical tree glyph for Source Control → Git tree. */
export function GitTreeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3.2h4.2v3.2H3z" />
      <path d="M8.2 6.6H13v3.2H8.2z" />
      <path d="M8.2 11H13v3.2H8.2z" />
      <path d="M5.1 6.4v6.2h3.1" />
      <path d="M5.1 8.2h3.1" />
    </svg>
  );
}

/** Flat SCM / git-branch glyph for the Source Control side-panel tab. */
export function SourceControlIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="4.5" cy="12.5" r="1.55" />
      <circle cx="4.5" cy="3.5" r="1.55" />
      <circle cx="11.5" cy="8" r="1.55" />
      <path d="M4.5 5.05v5.9" />
      <path d="M4.5 7.2c0 1.7 2.1 2.9 4.2 2.9h1.2" />
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

export function DiffIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 5.2h3.6M5 3.4v3.6" />
      <path d="M9.2 10.8h3.6" />
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

export function OpenInTerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" />
      <path d="M5 7l1.8 1.5L5 10" />
      <path d="M8.2 10h2.8" />
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

export function ThermometerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5a1.25 1.25 0 0 0-1.25 1.25v5.35a2.5 2.5 0 1 0 2.5 0V3.75A1.25 1.25 0 0 0 8 2.5z" />
      <path d="M8 10.2v1.3" />
    </svg>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.2 11.2a5.5 5.5 0 1 1 9.6 0" />
      <path d="M8 11.2l2.4-3.2" />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}
