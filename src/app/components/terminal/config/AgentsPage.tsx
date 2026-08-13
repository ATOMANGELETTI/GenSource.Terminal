import type { AgentConfig } from "../../../types";
import { activeProvider } from "../../../lib/agent";
import { ConfigCard, ConfigRow } from "./ConfigField";

interface AgentsPageProps {
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
}

const MODEL_OPTIONS = [
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
] as const;

export default function AgentsPage({ config, onChange }: AgentsPageProps) {
  const provider = activeProvider(config);

  const patchGemini = (patch: Partial<{ apiKey: string; model: string }>) => {
    onChange({
      ...config,
      activeProvider: "gemini",
      providers: {
        ...config.providers,
        gemini: {
          apiKey: patch.apiKey ?? provider.apiKey,
          model: patch.model ?? provider.model,
        },
      },
    });
  };

  return (
    <>
      <ConfigCard label="Provider">
        <ConfigRow label="Service" hint="Gemini-first; more providers later">
          <span className="config-chip">Gemini</span>
        </ConfigRow>
        <ConfigRow
          label="Model"
          hint="Used by the Agents panel"
          htmlFor="config-agent-model"
        >
          <select
            id="config-agent-model"
            className="config-form__control"
            value={provider.model}
            onChange={(event) => patchGemini({ model: event.target.value })}
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!MODEL_OPTIONS.some((option) => option.value === provider.model) ? (
              <option value={provider.model}>{provider.model}</option>
            ) : null}
          </select>
        </ConfigRow>
      </ConfigCard>

      <ConfigCard
        label="Credentials"
        footer="Stored in other/configs/agent.json. The Agents panel streams via Rust; the webview never holds outbound Gemini HTTP calls."
      >
        <ConfigRow
          label="API key"
          hint="Saved to agent.json; requests stay in Rust"
          htmlFor="config-agent-api-key"
          layout="stack"
        >
          <input
            id="config-agent-api-key"
            className="config-form__control"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza…"
            value={provider.apiKey}
            onChange={(event) => patchGemini({ apiKey: event.target.value })}
          />
        </ConfigRow>
      </ConfigCard>
    </>
  );
}
