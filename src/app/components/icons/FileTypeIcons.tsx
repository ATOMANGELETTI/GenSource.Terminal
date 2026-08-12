import type { SVGProps } from "react";

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

/** Muted Nord-friendly tints applied via CSS classes on the wrapper. */
export function FileCodeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M6 9.2 7.2 10.4 6 11.6M10 9.2 8.8 10.4 10 11.6" />
    </svg>
  );
}

export function FileJsonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M6.2 8.5c0 1.2-.7 1.8-1.4 2M6.2 12.5c0-1.2-.7-1.8-1.4-2M9.8 8.5c0 1.2.7 1.8 1.4 2M9.8 12.5c0-1.2.7-1.8 1.4-2" />
    </svg>
  );
}

export function FileMarkdownIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M5.5 11V8.2l1.4 1.6L8.3 8.2V11M10 11V8.5h1.2" />
    </svg>
  );
}

export function FileImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.2" />
      <circle cx="5.8" cy="6.5" r="1.1" />
      <path d="M2.8 11.2 6.2 8.3l2.2 2 2-1.8 2.5 2.7" />
    </svg>
  );
}

export function FileArchiveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M7.2 6.2h1.6M7.2 8h1.6M7.2 9.8h1.6M7.5 11.5h1" />
    </svg>
  );
}

export function FileScriptIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M6 8.5h4M6 10.5h2.5" />
    </svg>
  );
}

export function FileStyleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 2.5h4.2L11.5 5.3V13a.8.8 0 0 1-.8.8H4.5a.8.8 0 0 1-.8-.8V3.3a.8.8 0 0 1 .8-.8z" />
      <path d="M8.5 2.5V5.3h2.8" />
      <path d="M6 9.5h4M7.5 8v4" />
    </svg>
  );
}
