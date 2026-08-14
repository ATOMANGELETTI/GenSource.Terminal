import type {
  AgentLoggingSettings,
  LogLevelSettings,
  LoggingSettings,
} from "../../../types";
import { ConfigCard, ConfigRow, ConfigSwitch } from "./ConfigField";

const LEVELS: {
  key: keyof LogLevelSettings;
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

const AGENT_EVENTS: {
  key: keyof Pick<
    AgentLoggingSettings,
    "prompts" | "replies" | "tools" | "reasoning"
  >;
  label: string;
  hint: string;
}[] = [
  { key: "prompts", label: "Prompts", hint: "User messages sent to the model" },
  { key: "replies", label: "Replies", hint: "Final assistant text" },
  { key: "tools", label: "Tools", hint: "Tool calls and confirmations" },
  { key: "reasoning", label: "Reasoning", hint: "Model thought text" },
];

interface LoggingPageProps {
  logging: LoggingSettings;
  onPatch: (patch: Partial<LoggingSettings>) => void;
}

function LevelCard({
  label,
  idPrefix,
  levels,
  onChange,
}: {
  label: string;
  idPrefix: string;
  levels: LogLevelSettings;
  onChange: (key: keyof LogLevelSettings, checked: boolean) => void;
}) {
  return (
    <ConfigCard label={label}>
      {LEVELS.map(({ key, label: rowLabel, hint }) => (
        <ConfigRow
          key={key}
          label={rowLabel}
          hint={hint}
          htmlFor={`${idPrefix}-${key}`}
        >
          <ConfigSwitch
            id={`${idPrefix}-${key}`}
            checked={levels[key]}
            onChange={(checked) => onChange(key, checked)}
          />
        </ConfigRow>
      ))}
    </ConfigCard>
  );
}

export default function LoggingPage({ logging, onPatch }: LoggingPageProps) {
  return (
    <>
      <LevelCard
        label="App"
        idPrefix="config-log-app"
        levels={logging.app}
        onChange={(key, checked) =>
          onPatch({ app: { ...logging.app, [key]: checked } })
        }
      />
      <LevelCard
        label="Build"
        idPrefix="config-log-build"
        levels={logging.build}
        onChange={(key, checked) =>
          onPatch({ build: { ...logging.build, [key]: checked } })
        }
      />
      <LevelCard
        label="Agent levels"
        idPrefix="config-log-agent"
        levels={logging.agent}
        onChange={(key, checked) =>
          onPatch({ agent: { ...logging.agent, [key]: checked } })
        }
      />
      <ConfigCard label="Agent events">
        {AGENT_EVENTS.map(({ key, label, hint }) => (
          <ConfigRow
            key={key}
            label={label}
            hint={hint}
            htmlFor={`config-log-agent-${key}`}
          >
            <ConfigSwitch
              id={`config-log-agent-${key}`}
              checked={logging.agent[key]}
              onChange={(checked) =>
                onPatch({ agent: { ...logging.agent, [key]: checked } })
              }
            />
          </ConfigRow>
        ))}
      </ConfigCard>
    </>
  );
}
