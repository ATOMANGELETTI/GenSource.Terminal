import { useEffect, useMemo, useState } from 'react';

import { resolveFileIconSet } from '../lib/file-icons';
import { E2E_DEFAULT_SETTINGS, isE2eMode } from '../lib/e2e-window';
import { fetchSettings, subscribeSettingsChanges } from '../lib/settings';
import type { AppSettings, FileIconSet } from '../types';

/**
 * Latest file icon set preference with hot-reload via `settings-changed`.
 */
export function useFileIconSet(): FileIconSet {
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
        console.warn('Failed to load file icon set setting', error);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return useMemo(
    () => resolveFileIconSet(settings?.fileIconSet ?? 'catppuccin'),
    [settings],
  );
}
