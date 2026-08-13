import type { AppSettings } from "../../../types";
import { ALLOWED_FONT_FAMILIES } from "../../../lib/settings";
import ConfigField from "./ConfigField";

const CURSOR_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "bar", label: "Bar" },
] as const;

interface TerminalPageProps {
  settings: AppSettings;
  onPatch: (
    patch: Partial<AppSettings>,
    options?: { immediate?: boolean },
  ) => void;
  onOpenFolder: () => void;
}

export default function TerminalPage({
  settings,
  onPatch,
  onOpenFolder,
}: TerminalPageProps) {
  const terminalFont =
    settings.terminalFontFamily == null || settings.terminalFontFamily === ""
      ? ""
      : settings.terminalFontFamily;
  const terminalSize =
    settings.terminalFontSize == null ? "" : String(settings.terminalFontSize);

  return (
    <div className="config-form">
      <ConfigField label="Default profile" htmlFor="config-default-profile">
        <select
          id="config-default-profile"
          className="config-form__control"
          value={settings.defaultProfile}
          onChange={(event) => onPatch({ defaultProfile: event.target.value })}
        >
          {settings.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="Terminal font" htmlFor="config-term-font">
        <select
          id="config-term-font"
          className="config-form__control"
          value={terminalFont}
          onChange={(event) => {
            const value = event.target.value;
            onPatch({
              terminalFontFamily: value === "" ? null : value,
            });
          }}
        >
          <option value="">Same as UI font</option>
          {ALLOWED_FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="Terminal font size" htmlFor="config-term-size">
        <input
          id="config-term-size"
          className="config-form__control config-form__control--narrow"
          type="number"
          min={8}
          max={48}
          step={1}
          placeholder="UI size"
          value={terminalSize}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onPatch({ terminalFontSize: null });
              return;
            }
            const value = Number(raw);
            if (!Number.isFinite(value)) return;
            onPatch({ terminalFontSize: value });
          }}
          onBlur={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onPatch({ terminalFontSize: null }, { immediate: true });
              return;
            }
            const value = Number(raw);
            if (!Number.isFinite(value) || value <= 0) return;
            onPatch({ terminalFontSize: value }, { immediate: true });
          }}
        />
      </ConfigField>

      <ConfigField label="Scrollback lines" htmlFor="config-scrollback">
        <input
          id="config-scrollback"
          className="config-form__control config-form__control--narrow"
          type="number"
          min={100}
          max={100000}
          step={100}
          value={settings.scrollbackLines}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            onPatch({ scrollbackLines: value });
          }}
          onBlur={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            onPatch({ scrollbackLines: value }, { immediate: true });
          }}
        />
      </ConfigField>

      <ConfigField label="Cursor style" htmlFor="config-cursor-style">
        <select
          id="config-cursor-style"
          className="config-form__control"
          value={settings.cursorStyle}
          onChange={(event) => onPatch({ cursorStyle: event.target.value })}
        >
          {CURSOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="Cursor blink" htmlFor="config-cursor-blink">
        <input
          id="config-cursor-blink"
          className="config-form__checkbox"
          type="checkbox"
          checked={settings.cursorBlink}
          onChange={(event) => onPatch({ cursorBlink: event.target.checked })}
        />
      </ConfigField>

      <p className="config-form__note">
        Shell profiles stay file-driven in settings.json.{" "}
        <button
          type="button"
          className="config-form__link"
          onClick={onOpenFolder}
        >
          Open config folder
        </button>{" "}
        to edit profile commands and args.
      </p>
    </div>
  );
}
