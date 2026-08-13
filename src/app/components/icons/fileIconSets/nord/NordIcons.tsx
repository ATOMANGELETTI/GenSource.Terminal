import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function NordDriveIcon(props: IconProps) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2.5"
        y="4.5"
        width="13"
        height="8.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect x="4" y="6.5" width="4.5" height="1.2" rx="0.4" fill="currentColor" />
      <circle cx="5.2" cy="10.8" r="0.9" fill="currentColor" />
      <path
        d="M7.8 10.8h5.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M4.5 14.2v1.1M13.5 14.2v1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function NordFolderIcon({
  open = false,
  ...props
}: IconProps & { open?: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M2.5 6.2V14a1.4 1.4 0 0 0 1.4 1.4h10.2A1.4 1.4 0 0 0 15.5 14V7.4A1.4 1.4 0 0 0 14.1 6H9.2L7.6 4.1H3.9A1.4 1.4 0 0 0 2.5 5.5V6.2Z"
        fill="currentColor"
        fillOpacity="0.24"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 6.2h12.6"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M3.2 4.1h3.7l1.6 1.9"
        stroke="var(--nord13)"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {open ? (
        <path
          d="M5.2 9.2h7.6M5.2 11.4h5.4"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.75"
        />
      ) : null}
    </svg>
  );
}

export function NordFileIcon(props: IconProps) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4.8 2.5h4.6L13.5 6.1V14.8a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 2.5V6.1h4.1"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
