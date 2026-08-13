import type { LoggingSettings } from "../../../types";
import { ConfigCard, ConfigRow, ConfigSwitch } from "./ConfigField";

const LEVELS: {
  key: keyof LoggingSettings;
  label: string;
  hint: string;
}[] = [
  { key: "error", label: "Error", hint: "Failures that stop work" },
  { key: "warn", label: "Warn", hint: "Recoverable problems" },
  { key: "info", label: "Info", hint: "Normal operation" },
  { key: "debug", label: "Debug", hint: "Extra diagnostic detail" },
  { key: "trace", label: "Trace", hint: "Very verbose internals" },
  { key: "fatal", label: "Fatal", hint: "Process-ending failures" },
];

interface LoggingPageProps {
  logging: LoggingSettings;
  onPatch: (patch: Partial<LoggingSettings>) => void;
}

export default function LoggingPage({ logging, onPatch }: LoggingPageProps) {
  return (
    <ConfigCard label="Levels">
      {LEVELS.map(({ key, label, hint }) => (
        <ConfigRow
          key={key}
          label={label}
          hint={hint}
          htmlFor={`config-log-${key}`}
        >
          <ConfigSwitch
            id={`config-log-${key}`}
            checked={logging[key]}
            onChange={(checked) => onPatch({ [key]: checked })}
          />
        </ConfigRow>
      ))}
    </ConfigCard>
  );
}
