import type { ITheme } from "@xterm/xterm";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

/** Map live Nord semantic tokens into xterm ITheme (no hard-coded purple/glow). */
export function readNordXtermTheme(): ITheme {
  return {
    // rgba keeps alpha reliable for xterm; workspace `--bg` + TerminalParticleField are the backdrop.
    background: "rgba(0, 0, 0, 0)",
    foreground: cssVar("--text", "#eceff4"),
    cursor: cssVar("--accent", "#88c0d0"),
    cursorAccent: cssVar("--bg", "#2e3440"),
    selectionBackground: cssVar("--hover", "#434c5e"),
    selectionForeground: cssVar("--text", "#eceff4"),
    black: cssVar("--nord0", "#2e3440"),
    red: cssVar("--nord11", "#bf616a"),
    green: cssVar("--nord14", "#a3be8c"),
    yellow: cssVar("--nord13", "#ebcb8b"),
    blue: cssVar("--nord10", "#5e81ac"),
    magenta: cssVar("--nord15", "#b48ead"),
    cyan: cssVar("--nord8", "#88c0d0"),
    white: cssVar("--nord6", "#eceff4"),
    brightBlack: cssVar("--nord3", "#4c566a"),
    brightRed: cssVar("--nord11", "#bf616a"),
    brightGreen: cssVar("--nord14", "#a3be8c"),
    brightYellow: cssVar("--nord13", "#ebcb8b"),
    brightBlue: cssVar("--nord9", "#81a1c1"),
    brightMagenta: cssVar("--nord15", "#b48ead"),
    brightCyan: cssVar("--nord7", "#8fbcbb"),
    brightWhite: cssVar("--nord6", "#eceff4"),
  };
}
