import type { AppSettings } from "../../../types";
import { ConfigCard, ConfigRow, ConfigSwitch } from "./ConfigField";

interface WindowPageProps {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}

export default function WindowPage({ settings, onPatch }: WindowPageProps) {
  return (
    <ConfigCard label="Launch">
      <ConfigRow
        label="Start minimized"
        hint="Open in the tray instead of a window"
        htmlFor="config-start-minimized"
      >
        <ConfigSwitch
          id="config-start-minimized"
          checked={settings.startMinimized}
          onChange={(checked) => onPatch({ startMinimized: checked })}
        />
      </ConfigRow>
      <ConfigRow
        label="Autostart on login"
        hint="Launch with Windows"
        htmlFor="config-autostart"
      >
        <ConfigSwitch
          id="config-autostart"
          checked={settings.autostart}
          onChange={(checked) => onPatch({ autostart: checked })}
        />
      </ConfigRow>
      <ConfigRow
        label="Always on top"
        hint="Keep the window above other apps"
        htmlFor="config-always-on-top"
      >
        <ConfigSwitch
          id="config-always-on-top"
          checked={settings.alwaysOnTop}
          onChange={(checked) => onPatch({ alwaysOnTop: checked })}
        />
      </ConfigRow>
    </ConfigCard>
  );
}
