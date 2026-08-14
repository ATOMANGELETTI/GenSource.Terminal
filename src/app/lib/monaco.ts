import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") {
      return new cssWorker();
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new htmlWorker();
    }
    if (label === "typescript" || label === "javascript") {
      return new tsWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

export { monaco };

export const GENSOURCE_NORD_THEME = "gensource-nord";

export function cssThemeVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function defineGensourceNordTheme(): void {
  const bg = cssThemeVar("--bg", "#2e3440");
  const text = cssThemeVar("--text", "#eceff4");
  const muted = cssThemeVar("--text-muted", "#d8dee9");
  const accent = cssThemeVar("--accent", "#88c0d0");
  const hover = cssThemeVar("--hover", "#434c5e");
  const surface = cssThemeVar("--surface", "#3b4252");
  const border = cssThemeVar("--border", "#4c566a");
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  const base = scheme.includes("light") ? "vs" : "vs-dark";

  monaco.editor.defineTheme(GENSOURCE_NORD_THEME, {
    base,
    inherit: true,
    rules: [],
    colors: {
      "editor.background": bg,
      "editor.foreground": text,
      "editorLineNumber.foreground": muted,
      "editorLineNumber.activeForeground": text,
      "editorCursor.foreground": accent,
      "editor.selectionBackground": hover,
      "editor.inactiveSelectionBackground": hover,
      "editorWidget.background": surface,
      "editorWidget.border": border,
      "editorWidget.foreground": text,
      "editor.findMatchBackground": accent,
      "editor.findMatchHighlightBackground": hover,
      "scrollbarSlider.background": border,
      "scrollbarSlider.hoverBackground": muted,
      "editorGutter.background": bg,
    },
  });
}
