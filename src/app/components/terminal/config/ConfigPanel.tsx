import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  AboutIcon,
  AppearanceIcon,
  KeyboardIcon,
  LoggingIcon,
  TerminalIcon,
  WindowIcon,
} from "../../icons/MenuIcons";
import { fetchKeybindings, saveKeybindings } from "../../../lib/keybindings";
import {
  fetchAppInfo,
  fetchLogging,
  fetchSettings,
  saveLogging,
  saveSettings,
  subscribeSettingsChanges,
} from "../../../lib/settings";
import type {
  AppInfo,
  AppSettings,
  Keybinding,
  LoggingSettings,
} from "../../../types";
import AboutPage from "./AboutPage";
import AppearancePage from "./AppearancePage";
import KeyboardPage from "./KeyboardPage";
import LoggingPage from "./LoggingPage";
import TerminalPage from "./TerminalPage";
import WindowPage from "./WindowPage";

const SAVE_DEBOUNCE_MS = 300;
const CONFIG_CATEGORY_STORAGE_KEY = "gensource.config.category";

type ConfigCategory =
  | "appearance"
  | "window"
  | "terminal"
  | "logging"
  | "keyboard"
  | "about";

const CATEGORIES: {
  id: ConfigCategory;
  label: string;
  Icon: typeof AppearanceIcon;
}[] = [
  { id: "appearance", label: "Appearance", Icon: AppearanceIcon },
  { id: "window", label: "Window", Icon: WindowIcon },
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "logging", label: "Logging", Icon: LoggingIcon },
  { id: "keyboard", label: "Keyboard", Icon: KeyboardIcon },
  { id: "about", label: "About", Icon: AboutIcon },
];

function isConfigCategory(value: string): value is ConfigCategory {
  return CATEGORIES.some((category) => category.id === value);
}

function readStoredConfigCategory(): ConfigCategory {
  try {
    const stored = sessionStorage.getItem(CONFIG_CATEGORY_STORAGE_KEY);
    if (stored && isConfigCategory(stored)) return stored;
  } catch {
    // sessionStorage unavailable
  }
  return "appearance";
}

const CATEGORY_META: Record<
  ConfigCategory,
  { title: string; subtitle: string }
> = {
  appearance: {
    title: "Appearance",
    subtitle: "Theme, fonts, and visual accents",
  },
  window: {
    title: "Window",
    subtitle: "Launch and window behavior",
  },
  terminal: {
    title: "Terminal",
    subtitle: "Default profile, cursor, and scrollback",
  },
  logging: {
    title: "Logging",
    subtitle: "Levels written to other/logging/app",
  },
  keyboard: {
    title: "Keyboard",
    subtitle: "Shortcuts from keybindings.json",
  },
  about: {
    title: "About",
    subtitle: "App identity from appinfo.json",
  },
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ConfigPanel() {
  const [category, setCategory] = useState<ConfigCategory>(readStoredConfigCategory);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [logging, setLogging] = useState<LoggingSettings | null>(null);
  const [bindings, setBindings] = useState<Keybinding[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bindingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipExternalSettings = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(CONFIG_CATEGORY_STORAGE_KEY, category);
    } catch {
      // sessionStorage unavailable
    }
  }, [category]);

  const loadAll = useCallback(async () => {
    try {
      const [nextSettings, nextLogging, nextBindings, nextInfo] =
        await Promise.all([
          fetchSettings(),
          fetchLogging().catch(() => null),
          fetchKeybindings().catch(() => [] as Keybinding[]),
          fetchAppInfo().catch(() => null),
        ]);
      setSettings(nextSettings);
      if (nextLogging) setLogging(nextLogging);
      setBindings(nextBindings);
      if (nextInfo) setAppInfo(nextInfo);
      setLoadError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load config";
      setLoadError(message);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void subscribeSettingsChanges((next) => {
      if (cancelled) return;
      if (skipExternalSettings.current) return;
      setSettings(next);
      void fetchLogging()
        .then((value) => {
          if (!cancelled) setLogging(value);
        })
        .catch(() => undefined);
      void fetchKeybindings()
        .then((value) => {
          if (!cancelled) setBindings(value);
        })
        .catch(() => undefined);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      if (loggingTimer.current) clearTimeout(loggingTimer.current);
      if (bindingsTimer.current) clearTimeout(bindingsTimer.current);
    };
  }, []);

  const persistSettings = useCallback(async (next: AppSettings) => {
    skipExternalSettings.current = true;
    try {
      await saveSettings(next);
      setSaveError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings";
      setSaveError(message);
      console.warn("save_settings failed", error);
    } finally {
      window.setTimeout(() => {
        skipExternalSettings.current = false;
      }, 400);
    }
  }, []);

  const persistLogging = useCallback(async (next: LoggingSettings) => {
    try {
      await saveLogging(next);
      setSaveError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save logging";
      setSaveError(message);
      console.warn("save_logging failed", error);
    }
  }, []);

  const persistBindings = useCallback(async (next: Keybinding[]) => {
    try {
      await saveKeybindings({ bindings: next });
      setSaveError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save keybindings";
      setSaveError(message);
      console.warn("save_keybindings failed", error);
    }
  }, []);

  const scheduleSettingsSave = useCallback(
    (next: AppSettings) => {
      if (settingsTimer.current) clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => {
        void persistSettings(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistSettings],
  );

  const scheduleLoggingSave = useCallback(
    (next: LoggingSettings) => {
      if (loggingTimer.current) clearTimeout(loggingTimer.current);
      loggingTimer.current = setTimeout(() => {
        void persistLogging(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistLogging],
  );

  const scheduleBindingsSave = useCallback(
    (next: Keybinding[]) => {
      if (bindingsTimer.current) clearTimeout(bindingsTimer.current);
      bindingsTimer.current = setTimeout(() => {
        void persistBindings(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistBindings],
  );

  const patchSettings = useCallback(
    (patch: Partial<AppSettings>, options?: { immediate?: boolean }) => {
      setSettings((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        if (deepEqual(prev, next)) return prev;
        if (options?.immediate) {
          if (settingsTimer.current) clearTimeout(settingsTimer.current);
          void persistSettings(next);
        } else {
          scheduleSettingsSave(next);
        }
        return next;
      });
    },
    [persistSettings, scheduleSettingsSave],
  );

  const patchLogging = useCallback(
    (patch: Partial<LoggingSettings>) => {
      setLogging((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        if (deepEqual(prev, next)) return prev;
        scheduleLoggingSave(next);
        return next;
      });
    },
    [scheduleLoggingSave],
  );

  const updateBinding = useCallback(
    (id: string, patch: Partial<Keybinding>) => {
      setBindings((prev) => {
        const next = prev.map((binding) =>
          binding.id === id ? { ...binding, ...patch } : binding,
        );
        if (deepEqual(prev, next)) return prev;
        scheduleBindingsSave(next);
        return next;
      });
    },
    [scheduleBindingsSave],
  );

  const commitBindingShortcut = useCallback(
    (id: string, shortcut: string) => {
      setBindings((prev) => {
        const next = prev.map((binding) =>
          binding.id === id ? { ...binding, shortcut } : binding,
        );
        if (deepEqual(prev, next)) return prev;
        if (bindingsTimer.current) clearTimeout(bindingsTimer.current);
        void persistBindings(next);
        return next;
      });
    },
    [persistBindings],
  );

  const openConfigFolder = useCallback(() => {
    void invoke("open_configs_folder").catch((error: unknown) => {
      console.warn("open_configs_folder failed", error);
    });
  }, []);

  const meta = CATEGORY_META[category];

  return (
    <div className="config-panel" data-testid="config-panel">
      <nav className="config-panel__rail" aria-label="Config categories">
        {CATEGORIES.map(({ id, label, Icon }) => {
          const active = category === id;
          return (
            <button
              key={id}
              type="button"
              className={
                active
                  ? "config-panel__rail-btn config-panel__rail-btn--active"
                  : "config-panel__rail-btn"
              }
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              onClick={() => setCategory(id)}
            >
              <Icon className="config-panel__rail-icon" />
            </button>
          );
        })}
      </nav>

      <div className="config-panel__main">
        <header className="config-panel__header">
          <h2 className="config-panel__title">{meta.title}</h2>
          <p className="config-panel__subtitle">{meta.subtitle}</p>
        </header>

        <div className="config-panel__body">
          {loadError ? (
            <p className="config-panel__status config-panel__status--error">
              {loadError}
            </p>
          ) : null}
          {saveError ? (
            <p className="config-panel__status config-panel__status--error">
              {saveError}
            </p>
          ) : null}

          {category === "appearance" && settings ? (
            <AppearancePage settings={settings} onPatch={patchSettings} />
          ) : null}
          {category === "window" && settings ? (
            <WindowPage settings={settings} onPatch={patchSettings} />
          ) : null}
          {category === "terminal" && settings ? (
            <TerminalPage
              settings={settings}
              onPatch={patchSettings}
              onOpenFolder={openConfigFolder}
            />
          ) : null}
          {category === "logging" && logging ? (
            <LoggingPage logging={logging} onPatch={patchLogging} />
          ) : null}
          {category === "logging" && !logging && settings ? (
            <p className="config-form__note">Logging settings unavailable.</p>
          ) : null}
          {category === "keyboard" ? (
            <KeyboardPage
              bindings={bindings}
              onUpdate={updateBinding}
              onCommitShortcut={commitBindingShortcut}
            />
          ) : null}
          {category === "about" ? <AboutPage appInfo={appInfo} /> : null}

          {!loadError &&
          (((category === "appearance" ||
            category === "window" ||
            category === "terminal") &&
            !settings) ||
            (category === "logging" && !logging && !settings)) ? (
            <p className="config-panel__status">Loading…</p>
          ) : null}
        </div>

        <footer className="config-panel__footer">
          <button
            type="button"
            className="config-panel__footer-btn"
            onClick={openConfigFolder}
          >
            Open config folder
          </button>
        </footer>
      </div>
    </div>
  );
}
