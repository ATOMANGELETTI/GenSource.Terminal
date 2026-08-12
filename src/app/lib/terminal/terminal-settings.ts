import type { CursorStyle, ParticleEffect, TerminalProfile } from "../../types";
import { resolveFontFamily } from "../settings";

const DEFAULT_SCROLLBACK = 5000;
const MIN_SCROLLBACK = 100;
const MAX_SCROLLBACK = 100_000;

const BUILTIN_PROFILES: TerminalProfile[] = [
  {
    id: "powershell",
    name: "PowerShell",
    command: "powershell.exe",
    args: ["-NoLogo"],
    startingDirectory: null,
  },
  {
    id: "cmd",
    name: "CMD",
    command: "cmd.exe",
    args: [],
    startingDirectory: null,
  },
];

/** Clamp scrollback to `[100, 100000]`; non-finite → `5000`. */
export function clampScrollbackLines(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SCROLLBACK;
  }
  if (value < MIN_SCROLLBACK) {
    return MIN_SCROLLBACK;
  }
  if (value > MAX_SCROLLBACK) {
    return MAX_SCROLLBACK;
  }
  return Math.floor(value);
}

/** Accept only xterm cursor styles; invalid → `"bar"`. */
export function resolveCursorStyle(value: string): CursorStyle {
  if (value === "block" || value === "underline" || value === "bar") {
    return value;
  }
  return "bar";
}

/** Accept only terminal particle modes; invalid → `"dust"`. */
export function resolveParticleEffect(value: string): ParticleEffect {
  const key = value.trim().toLowerCase();
  if (key === "dust" || key === "constellation" || key === "orbs") {
    return key;
  }
  return "dust";
}

/** Empty profile list → built-in PowerShell + CMD. */
export function ensureProfiles(
  profiles: TerminalProfile[] | null | undefined,
): TerminalProfile[] {
  if (!profiles || profiles.length === 0) {
    return BUILTIN_PROFILES.map((p) => ({ ...p, args: [...(p.args ?? [])] }));
  }
  return profiles;
}

/**
 * Resolve `defaultProfile` against known ids; missing → `powershell` if
 * present, else first profile.
 */
export function resolveDefaultProfileId(
  defaultProfile: string,
  profiles: TerminalProfile[],
): string {
  if (profiles.some((p) => p.id === defaultProfile)) {
    return defaultProfile;
  }
  if (profiles.some((p) => p.id === "powershell")) {
    return "powershell";
  }
  return profiles[0]?.id ?? "powershell";
}

/**
 * Terminal font CSS stack: optional `terminalFontFamily` via allowlist
 * resolver, else chrome `fontFamily`.
 */
export function resolveTerminalFontFamily(
  terminalFontFamily: string | null | undefined,
  chromeFontFamily: string,
): string {
  const candidate =
    terminalFontFamily != null && terminalFontFamily.trim() !== ""
      ? terminalFontFamily
      : chromeFontFamily;
  return resolveFontFamily(candidate);
}

/** Terminal font size in px; invalid/missing → chrome size (or 14). */
export function resolveTerminalFontSize(
  terminalFontSize: number | null | undefined,
  chromeFontSize: number,
): number {
  if (
    terminalFontSize != null &&
    Number.isFinite(terminalFontSize) &&
    terminalFontSize > 0
  ) {
    return terminalFontSize;
  }
  if (Number.isFinite(chromeFontSize) && chromeFontSize > 0) {
    return chromeFontSize;
  }
  return 14;
}
