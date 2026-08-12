import { useEffect, useMemo, useState } from "react";

import { E2E_DEFAULT_SETTINGS, isE2eMode } from "../lib/e2e-window";
import {
  fetchSettings,
  subscribeSettingsChanges,
} from "../lib/settings";
import {
  clampScrollbackLines,
  ensureProfiles,
  resolveCursorStyle,
  resolveDefaultProfileId,
  resolveParticleEffect,
  resolveTerminalFontFamily,
  resolveTerminalFontSize,
} from "../lib/terminal/terminal-settings";
import type {
  AppSettings,
  CursorStyle,
  ParticleEffect,
  TerminalProfile,
} from "../types";

export interface TerminalSettingsSlice {
  fontFamily: string;
  fontSize: number;
  scrollbackLines: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  particleEffect: ParticleEffect;
  defaultProfile: string;
  profiles: TerminalProfile[];
  /** Latest full settings payload (null until first load). */
  settings: AppSettings | null;
}

function toSlice(settings: AppSettings): Omit<TerminalSettingsSlice, "settings"> {
  const profiles = ensureProfiles(settings.profiles);
  return {
    fontFamily: resolveTerminalFontFamily(
      settings.terminalFontFamily,
      settings.fontFamily,
    ),
    fontSize: resolveTerminalFontSize(
      settings.terminalFontSize,
      settings.fontSize,
    ),
    scrollbackLines: clampScrollbackLines(settings.scrollbackLines),
    cursorStyle: resolveCursorStyle(String(settings.cursorStyle)),
    cursorBlink: Boolean(settings.cursorBlink),
    particleEffect: resolveParticleEffect(String(settings.particleEffect ?? "")),
    defaultProfile: resolveDefaultProfileId(settings.defaultProfile, profiles),
    profiles,
  };
}

/**
 * Latest terminal-relevant settings with hot-reload via `settings-changed`.
 * Profile / defaultProfile edits apply to subsequent new tabs only.
 */
export function useTerminalSettings(): TerminalSettingsSlice {
  const [settings, setSettings] = useState<AppSettings | null>(() =>
    isE2eMode() ? E2E_DEFAULT_SETTINGS : null,
  );

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    if (isE2eMode()) {
      return;
    }

    void (async () => {
      try {
        const stop = await subscribeSettingsChanges((next) => {
          if (!cancelled) {
            setSettings(next);
          }
        });
        if (cancelled) {
          stop();
          return;
        }
        unlisten = stop;
        const loaded = await fetchSettings();
        if (!cancelled) {
          setSettings(loaded);
        }
      } catch (error) {
        console.warn("Failed to load terminal settings", error);
        if (!cancelled) {
          setSettings(E2E_DEFAULT_SETTINGS);
        }
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return useMemo(() => {
    const base = settings ?? E2E_DEFAULT_SETTINGS;
    return {
      ...toSlice(base),
      settings,
    };
  }, [settings]);
}
