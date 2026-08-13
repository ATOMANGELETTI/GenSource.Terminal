import type { AppSettings } from "../../../types";
import ConfigField from "./ConfigField";

interface WindowPageProps {
  settings: AppSettings;
  onPatch: (patch: Partial<AppSettings>) => void;
}

export default function WindowPage({ settings, onPatch }: WindowPageProps) {
  return (
    <div className="config-form">
      <ConfigField label="Start minimized" htmlFor="config-start-minimized">
        <input
          id="config-start-minimized"
          className="config-form__checkbox"
          type="checkbox"
          checked={settings.startMinimized}
          onChange={(event) =>
            onPatch({ startMinimized: event.target.checked })
          }
        />
      </ConfigField>

      <ConfigField label="Autostart on login" htmlFor="config-autostart">
        <input
          id="config-autostart"
          className="config-form__checkbox"
          type="checkbox"
          checked={settings.autostart}
          onChange={(event) => onPatch({ autostart: event.target.checked })}
        />
      </ConfigField>

      <ConfigField label="Always on top" htmlFor="config-always-on-top">
        <input
          id="config-always-on-top"
          className="config-form__checkbox"
          type="checkbox"
          checked={settings.alwaysOnTop}
          onChange={(event) =>
            onPatch({ alwaysOnTop: event.target.checked })
          }
        />
      </ConfigField>
    </div>
  );
}
