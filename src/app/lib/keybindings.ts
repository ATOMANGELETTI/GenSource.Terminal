import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

import type { Keybinding, KeybindingsFile } from "../types";
import { isE2eMode } from "./e2e-window";

export async function fetchKeybindings(): Promise<Keybinding[]> {
  if (isE2eMode()) {
    return [];
  }
  return invoke<Keybinding[]>("get_keybindings");
}

export async function saveKeybindings(file: KeybindingsFile): Promise<void> {
  await invoke("save_keybindings", { file });
}

/**
 * Loads `keybindings.json` once and exposes a `label(id)` lookup for
 * rendering shortcut text next to a menu row (e.g. "Ctrl+R").
 */
export function useKeybindingLabels() {
  const [bindings, setBindings] = useState<Keybinding[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchKeybindings()
      .then((loaded) => {
        if (!cancelled) {
          setBindings(loaded);
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to load keybindings", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = (id: string): string | undefined => {
    const binding = bindings.find((b) => b.id === id);
    return binding?.enabled && binding.shortcut ? binding.shortcut : undefined;
  };

  return { bindings, label };
}

type ShortcutHandlers = Record<string, () => void>;

interface ParsedShortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((part) => part.toLowerCase());

  return {
    ctrl: modifiers.includes("ctrl") || modifiers.includes("control"),
    shift: modifiers.includes("shift"),
    alt: modifiers.includes("alt"),
    key: key.toLowerCase(),
  };
}

function matchesShortcut(event: KeyboardEvent, parsed: ParsedShortcut): boolean {
  return (
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.key.toLowerCase() === parsed.key
  );
}

// Copy/Paste already work natively in the webview; their bindings only
// drive the menu shortcut label, never `preventDefault()`, so native
// clipboard behavior stays intact.
const LABEL_ONLY_IDS = new Set(["content.copy", "content.paste"]);

/**
 * Installs a single `keydown` listener that dispatches every enabled
 * `local`-scope keybinding to the matching handler in `handlers` (keyed by
 * binding id). Only active while the window that calls this hook has
 * focus — global, OS-wide shortcuts are handled entirely in Rust.
 */
export function useLocalShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    let cancelled = false;
    let bindings: Keybinding[] = [];

    void fetchKeybindings()
      .then((loaded) => {
        if (!cancelled) {
          bindings = loaded;
        }
      })
      .catch((error: unknown) => {
        console.warn("Failed to load keybindings for shortcuts", error);
      });

    const onKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindings) {
        if (
          !binding.enabled ||
          binding.scope !== "local" ||
          !binding.shortcut
        ) {
          continue;
        }
        const handler = handlersRef.current[binding.id];
        if (!handler) {
          continue;
        }
        const parsed = parseShortcut(binding.shortcut);
        if (!parsed || !matchesShortcut(event, parsed)) {
          continue;
        }
        if (!LABEL_ONLY_IDS.has(binding.id)) {
          event.preventDefault();
        }
        handler();
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
