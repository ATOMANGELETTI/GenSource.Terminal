import type { LoggingSettings } from "../../../types";
import ConfigField from "./ConfigField";

const LEVELS: { key: keyof LoggingSettings; label: string }[] = [
  { key: "error", label: "Error" },
  { key: "warn", label: "Warn" },
  { key: "info", label: "Info" },
  { key: "debug", label: "Debug" },
  { key: "trace", label: "Trace" },
  { key: "fatal", label: "Fatal" },
];

interface LoggingPageProps {
  logging: LoggingSettings;
  onPatch: (patch: Partial<LoggingSettings>) => void;
}

export default function LoggingPage({ logging, onPatch }: LoggingPageProps) {
  return (
    <div className="config-form">
      {LEVELS.map(({ key, label }) => (
        <ConfigField
          key={key}
          label={label}
          htmlFor={`config-log-${key}`}
        >
          <input
            id={`config-log-${key}`}
            className="config-form__checkbox"
            type="checkbox"
            checked={logging[key]}
            onChange={(event) => onPatch({ [key]: event.target.checked })}
          />
        </ConfigField>
      ))}
    </div>
  );
}
