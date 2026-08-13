import type { AppSettings } from "../../../types";
import { ALLOWED_FONT_FAMILIES } from "../../../lib/settings";
import ConfigField from "./ConfigField";

const THEME_OPTIONS = [
  { value: "nord-polar-night", label: "Polar Night" },
  { value: "nord-snow-storm", label: "Snow Storm" },
  { value: "nord-frost", label: "Frost (follow OS)" },
  { value: "nord-frost-dark", label: "Frost Dark" },
  { value: "nord-frost-light", label: "Frost Light" },
  { value: "nord-aurora", label: "Aurora (follow OS)" },
  { value: "nord-aurora-dark", label: "Aurora Dark" },
  { value: "nord-aurora-light", label: "Aurora Light" },
  { value: "system", label: "System" },
] as const;

const PARTICLE_OPTIONS = [
  { value: "dust", label: "Dust" },
  { value: "constellation", label: "Constellation" },
  { value: "orbs", label: "Orbs" },
] as const;

const ICON_SET_OPTIONS = [
  { value: "catppuccin", label: "Catppuccin" },
  { value: "material", label: "Material" },
  { value: "nord", label: "Nord" },
] as const;

interface AppearancePageProps {
  settings: AppSettings;
  onPatch: (
    patch: Partial<AppSettings>,
    options?: { immediate?: boolean },
  ) => void;
}

export default function AppearancePage({
  settings,
  onPatch,
}: AppearancePageProps) {
  return (
    <div className="config-form">
      <ConfigField label="Theme" htmlFor="config-theme">
        <select
          id="config-theme"
          className="config-form__control"
          value={settings.theme}
          onChange={(event) => onPatch({ theme: event.target.value })}
        >
          {THEME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="UI font" htmlFor="config-font-family">
        <select
          id="config-font-family"
          className="config-form__control"
          value={settings.fontFamily}
          onChange={(event) => onPatch({ fontFamily: event.target.value })}
        >
          {ALLOWED_FONT_FAMILIES.map((family) => (
            <option key={family} value={family}>
              {family}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="UI font size" htmlFor="config-font-size">
        <input
          id="config-font-size"
          className="config-form__control config-form__control--narrow"
          type="number"
          min={8}
          max={32}
          step={1}
          value={settings.fontSize}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            onPatch({ fontSize: value });
          }}
          onBlur={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value) || value <= 0) return;
            onPatch({ fontSize: value }, { immediate: true });
          }}
        />
      </ConfigField>

      <ConfigField label="Particle effect" htmlFor="config-particle">
        <select
          id="config-particle"
          className="config-form__control"
          value={settings.particleEffect}
          onChange={(event) =>
            onPatch({ particleEffect: event.target.value })
          }
        >
          {PARTICLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ConfigField>

      <ConfigField label="File icon set" htmlFor="config-file-icons">
        <select
          id="config-file-icons"
          className="config-form__control"
          value={settings.fileIconSet}
          onChange={(event) => onPatch({ fileIconSet: event.target.value })}
        >
          {ICON_SET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ConfigField>
    </div>
  );
}
