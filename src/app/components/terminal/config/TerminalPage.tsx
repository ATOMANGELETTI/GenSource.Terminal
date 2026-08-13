import type { AppSettings } from "../../../types";
import { ALLOWED_FONT_FAMILIES } from "../../../lib/settings";
import {
  ConfigCard,
  ConfigRow,
  ConfigSegmented,
  ConfigSwitch,
} from "./ConfigField";

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
    <>
      <ConfigCard
        label="Shell"
        footer={
          <>
            Profiles stay file-driven in settings.json.{" "}
            <button
              type="button"
              className="config-form__link"
              onClick={onOpenFolder}
            >
              Open config folder
            </button>{" "}
            to edit commands and args.
          </>
        }
      >
        <ConfigRow
          label="Default profile"
          hint="Used for new tabs"
          htmlFor="config-default-profile"
        >
          <select
            id="config-default-profile"
            className="config-form__control"
            value={settings.defaultProfile}
            onChange={(event) =>
              onPatch({ defaultProfile: event.target.value })
            }
          >
            {settings.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </ConfigRow>
      </ConfigCard>

      <ConfigCard label="Typeface">
        <ConfigRow
          label="Terminal font"
          hint="Empty follows the UI font"
          htmlFor="config-term-font"
        >
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
        </ConfigRow>
        <ConfigRow
          label="Terminal font size"
          hint="Leave blank for UI size"
          htmlFor="config-term-size"
        >
          <input
            id="config-term-size"
            className="config-form__control config-form__control--narrow"
            type="number"
            min={8}
            max={48}
            step={1}
            placeholder="UI"
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
        </ConfigRow>
      </ConfigCard>

      <ConfigCard label="Cursor">
        <ConfigRow label="Style" hint="Caret shape in the shell" layout="stack">
          <ConfigSegmented
            ariaLabel="Cursor style"
            value={settings.cursorStyle}
            options={CURSOR_OPTIONS}
            onChange={(value) => onPatch({ cursorStyle: value })}
          />
        </ConfigRow>
        <ConfigRow
          label="Blink"
          hint="Animate the caret"
          htmlFor="config-cursor-blink"
        >
          <ConfigSwitch
            id="config-cursor-blink"
            checked={settings.cursorBlink}
            onChange={(checked) => onPatch({ cursorBlink: checked })}
          />
        </ConfigRow>
      </ConfigCard>

      <ConfigCard label="History">
        <ConfigRow
          label="Scrollback lines"
          hint="Buffer kept above the viewport"
          htmlFor="config-scrollback"
        >
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
        </ConfigRow>
      </ConfigCard>
    </>
  );
}
