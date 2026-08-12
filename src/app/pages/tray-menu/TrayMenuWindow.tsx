import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useEffect, useState } from "react";

import {
  CheckUpdatesIcon,
  HideIcon,
  PreferencesIcon,
  QuitIcon,
  ShowIcon,
} from "../../components/icons/MenuIcons";
import {
  applySettingsToDom,
  fetchAppInfo,
  initSettingsFromBackend,
  subscribeSettingsChanges,
} from "../../lib/settings";
import {
  E2E_APP_INFO,
  E2E_DEFAULT_SETTINGS,
  isE2eMode,
} from "../../lib/e2e-window";
import { useKeybindingLabels } from "../../lib/keybindings";
import {
  hideMainWindow,
  isMainWindowVisible,
  showMainWindow,
} from "../../lib/window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppInfo } from "../../types";

/**
 * Standalone root rendered in the dedicated `tray-menu` Tauri window (see
 * tauri.conf.json + lib.rs `on_tray_icon_event`). Not an overlay inside the
 * main window — this window is transparent/undecorated and gets positioned
 * above the system tray icon on right-click.
 */
export default function TrayMenuWindow() {
  const { label } = useKeybindingLabels();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [mainVisible, setMainVisible] = useState(true);

  // Same settings/theme pipeline as App.tsx — this webview has its own DOM,
  // so data-theme must be set here or the flyout stays on :root Polar Night.
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      if (isE2eMode()) {
        applySettingsToDom(E2E_DEFAULT_SETTINGS);
        setInfo(E2E_APP_INFO);
        return;
      }

      try {
        // Subscribe before fetch so a setup-time `settings-changed` emit is
        // not missed if this window boots before `.setup` finishes.
        const stop = await subscribeSettingsChanges();
        if (cancelled) {
          stop();
        } else {
          unlisten = stop;
        }
        await initSettingsFromBackend();
      } catch (error) {
        console.warn("Failed to initialize tray settings from backend", error);
      }

      try {
        const appInfo = await fetchAppInfo();
        if (!cancelled) {
          setInfo(appInfo);
        }
      } catch (error) {
        console.warn("Failed to load tray app info", error);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Refresh Hide/Show whenever this flyout is focused (right-click opens it).
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const refresh = async () => {
      try {
        const visible = await isMainWindowVisible();
        if (!cancelled) {
          setMainVisible(visible);
        }
      } catch (error) {
        console.warn("Failed to read main window visibility", error);
      }
    };

    void refresh();

    try {
      void getCurrentWindow()
        .onFocusChanged(({ payload: focused }) => {
          if (focused) {
            void refresh();
          }
        })
        .then((stop) => {
          if (cancelled) {
            stop();
          } else {
            unlisten = stop;
          }
        });
    } catch (error) {
      console.warn("Tray focus listener unavailable", error);
    }

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const productName = info?.productName ?? info?.name ?? "GenSource Terminal";

  const run = (action: () => void | Promise<void>) => () => {
    void action();
  };

  const toggleMainVisibility = async () => {
    if (mainVisible) {
      await hideMainWindow();
      setMainVisible(false);
    } else {
      await showMainWindow();
      setMainVisible(true);
    }
  };

  const notify = async (body: string) => {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (granted) {
      sendNotification({ title: productName, body });
    }
  };

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update?.available) {
        await notify(`Update ${update.version} is available.`);
      } else {
        await notify("You're on the latest version.");
      }
    } catch (error) {
      console.warn("Update check failed", error);
      await notify("Updates aren't configured for this build.");
    }
  };

  return (
    <div className="tray-window">
      <nav className="context-menu tray-context-menu" role="menu">
        <div className="context-menu__header">
          <span className="context-menu__header-name">
            <span className="context-menu__header-dot" aria-hidden="true" />
            {productName}
          </span>
          {info?.version && (
            <span className="context-menu__header-version">v{info.version}</span>
          )}
        </div>

        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(toggleMainVisibility)}
        >
          {mainVisible ? (
            <HideIcon className="context-menu__icon" />
          ) : (
            <ShowIcon className="context-menu__icon" />
          )}
          <span className="context-menu__label">
            {mainVisible ? "Hide" : "Show"}
          </span>
          <span className="context-menu__shortcut">
            {label(mainVisible ? "window.hide" : "window.show")}
          </span>
        </button>
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(() => invoke("open_configs_folder"))}
        >
          <PreferencesIcon className="context-menu__icon" />
          <span className="context-menu__label">Preferences</span>
          <span className="context-menu__shortcut">
            {label("content.preferences")}
          </span>
        </button>
        <button
          type="button"
          className="context-menu__item"
          role="menuitem"
          onClick={run(checkForUpdates)}
        >
          <CheckUpdatesIcon className="context-menu__icon" />
          <span className="context-menu__label">Check Updates</span>
        </button>

        <div className="context-menu__separator" role="separator" />

        <button
          type="button"
          className="context-menu__item context-menu__item--destructive"
          role="menuitem"
          onClick={run(() => invoke("quit_app"))}
        >
          <QuitIcon className="context-menu__icon" />
          <span className="context-menu__label">Quit {productName}</span>
          <span className="context-menu__shortcut">{label("app.quit")}</span>
        </button>
      </nav>
    </div>
  );
}
