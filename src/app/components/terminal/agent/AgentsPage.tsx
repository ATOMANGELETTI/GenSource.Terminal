import { useCallback, useEffect, useState } from "react";

import type { AgentConfig } from "../../../types";
import { activeProvider } from "../../../lib/agent";
import {
  createAgentVault,
  isAgentVaultUnlocked,
  saveVaultApiKey,
  unlockAgentVault,
  vaultExists,
} from "../../../lib/agent-vault";
import {
  ConfigCard,
  ConfigRow,
  ConfigSwitch,
} from "../config/ConfigField";

interface AgentsPageProps {
  config: AgentConfig;
  onChange: (next: AgentConfig) => void;
  envVaultPassword?: string;
  envGeminiApiKey?: string;
}

const MODEL_OPTIONS = [
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
] as const;

export default function AgentsPage({
  config,
  onChange,
  envVaultPassword = "",
  envGeminiApiKey = "",
}: AgentsPageProps) {
  const provider = activeProvider(config);
  const jsonKey = provider.apiKey.trim();
  const envPassword = envVaultPassword.trim();
  const envKey = envGeminiApiKey.trim();

  const [exists, setExists] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(isAgentVaultUnlocked());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState(jsonKey || envKey);
  const [savePasswordInJson, setSavePasswordInJson] = useState(
    Boolean(config.vaultPassword?.trim()),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void vaultExists()
      .then((value) => {
        if (!cancelled) setExists(value);
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!unlocked && jsonKey && !apiKeyDraft) {
      setApiKeyDraft(jsonKey);
    }
  }, [apiKeyDraft, jsonKey, unlocked]);

  const persistAgent = useCallback(
    (patch: {
      model?: string;
      vaultPassword?: string;
    }) => {
      onChange({
        ...config,
        vaultPassword:
          patch.vaultPassword !== undefined
            ? patch.vaultPassword
            : savePasswordInJson
              ? (config.vaultPassword ?? "")
              : "",
        activeProvider: "gemini",
        providers: {
          ...config.providers,
          gemini: {
            apiKey: "",
            model: patch.model ?? provider.model,
          },
        },
      });
    },
    [config, onChange, provider.model, savePasswordInJson],
  );

  const passwordForJson = useCallback(() => {
    return (
      password.trim() || envPassword || (config.vaultPassword ?? "").trim()
    );
  }, [config.vaultPassword, envPassword, password]);

  const handleSavePasswordToggle = useCallback(
    (checked: boolean) => {
      const pwd = passwordForJson();
      if (checked && !pwd) {
        setError("Enter a password to save it in agent.json.");
        setSavePasswordInJson(false);
        return;
      }
      setSavePasswordInJson(checked);
      setError(null);
      persistAgent({ vaultPassword: checked ? pwd : "" });
    },
    [passwordForJson, persistAgent],
  );

  const handleCreate = useCallback(async () => {
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!apiKeyDraft.trim()) {
      setError("API key is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAgentVault(password, apiKeyDraft.trim());
      persistAgent({
        vaultPassword: savePasswordInJson ? password : "",
      });
      setUnlocked(true);
      setExists(true);
      setPassword("");
      setConfirmPassword("");
      setStatus("Vault created. Key cached for this session.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create vault");
    } finally {
      setBusy(false);
    }
  }, [
    apiKeyDraft,
    confirmPassword,
    password,
    persistAgent,
    savePasswordInJson,
  ]);

  const handleUnlock = useCallback(async () => {
    if (!password) {
      setError("Enter your vault password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await unlockAgentVault(password);
      let key = result.apiKey;
      if (!key && jsonKey) {
        await saveVaultApiKey(jsonKey);
        key = jsonKey;
      }
      if (!key && envKey) {
        await saveVaultApiKey(envKey);
        key = envKey;
      }
      persistAgent({
        vaultPassword: savePasswordInJson ? password : "",
      });
      if (key) {
        setApiKeyDraft(key);
      }
      setUnlocked(true);
      setPassword("");
      setStatus("Vault unlocked for this session.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }, [envKey, jsonKey, password, persistAgent, savePasswordInJson]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKeyDraft.trim()) {
      setError("API key is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveVaultApiKey(apiKeyDraft.trim());
      persistAgent({});
      setStatus("API key saved to the vault.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save key");
    } finally {
      setBusy(false);
    }
  }, [apiKeyDraft, persistAgent]);

  return (
    <>
      <ConfigCard label="Provider">
        <ConfigRow label="Service" hint="Gemini-first; more providers later">
          <span className="config-chip">Gemini</span>
        </ConfigRow>
        <ConfigRow
          label="Model"
          hint="Used by the Agents panel"
          htmlFor="agent-settings-model"
        >
          <select
            id="agent-settings-model"
            className="config-form__control"
            value={provider.model}
            disabled={!unlocked && exists !== false}
            onChange={(event) => persistAgent({ model: event.target.value })}
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
        label="Vault password"
        footer={
          envPassword
            ? "Dev .env supplied the vault password. It is not written to agent.json unless you enable this option."
            : "Optional for portable packaged builds. Dev .env GENSOURCE_VAULT_PASSWORD is never copied here automatically."
        }
      >
        <ConfigRow
          label="Save in agent.json"
          hint="Unlocks the vault on the Agents tab without typing the password"
          htmlFor="agent-settings-save-password"
        >
          <ConfigSwitch
            id="agent-settings-save-password"
            checked={savePasswordInJson}
            onChange={handleSavePasswordToggle}
            label="Save password in agent.json"
          />
        </ConfigRow>
      </ConfigCard>

      {exists === null ? (
        <p className="config-form__note">Checking vault…</p>
      ) : null}

      {exists === false ? (
        <ConfigCard
          label="Create vault"
          footer="Password unlocks the portable Stronghold file under other/database/stronghold/. The Gemini key is not stored in agent.json."
        >
          <ConfigRow
            label="Password"
            hint="First run — you will need this each session unless saved or provided via .env"
            htmlFor="agent-settings-vault-password"
            layout="stack"
          >
            <input
              id="agent-settings-vault-password"
              className="config-form__control"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </ConfigRow>
          <ConfigRow
            label="Confirm"
            htmlFor="agent-settings-vault-confirm"
            layout="stack"
          >
            <input
              id="agent-settings-vault-confirm"
              className="config-form__control"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </ConfigRow>
          <ConfigRow
            label="API key"
            hint="Stored in the vault; requests stay in Rust"
            htmlFor="agent-settings-api-key"
            layout="stack"
          >
            <input
              id="agent-settings-api-key"
              className="config-form__control"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
            />
          </ConfigRow>
          <ConfigRow label="">
            <button
              type="button"
              className="config-form__control"
              disabled={busy}
              onClick={() => void handleCreate()}
            >
              {busy ? "Creating…" : "Create vault"}
            </button>
          </ConfigRow>
        </ConfigCard>
      ) : null}

      {exists && !unlocked ? (
        <ConfigCard
          label="Unlock vault"
          footer="Unlocks other/database/stronghold/vault.hold for this session and caches the key in Rust."
        >
          <ConfigRow
            label="Password"
            htmlFor="agent-settings-unlock"
            layout="stack"
          >
            <input
              id="agent-settings-unlock"
              className="config-form__control"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleUnlock();
              }}
            />
          </ConfigRow>
          <ConfigRow label="">
            <button
              type="button"
              className="config-form__control"
              disabled={busy}
              onClick={() => void handleUnlock()}
            >
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </ConfigRow>
        </ConfigCard>
      ) : null}

      {unlocked ? (
        <ConfigCard
          label="Credentials"
          footer="Key lives in the Stronghold vault beside the exe. Model and system prompt stay in agent.json."
        >
          <ConfigRow
            label="API key"
            hint="Saved to the vault; requests stay in Rust"
            htmlFor="agent-settings-api-key-edit"
            layout="stack"
          >
            <input
              id="agent-settings-api-key-edit"
              className="config-form__control"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza…"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
            />
          </ConfigRow>
          <ConfigRow label="">
            <button
              type="button"
              className="config-form__control"
              disabled={busy}
              onClick={() => void handleSaveKey()}
            >
              {busy ? "Saving…" : "Save key"}
            </button>
          </ConfigRow>
        </ConfigCard>
      ) : null}

      {error ? (
        <p className="config-panel__status config-panel__status--error">{error}</p>
      ) : null}
      {status ? <p className="config-form__note">{status}</p> : null}
    </>
  );
}
