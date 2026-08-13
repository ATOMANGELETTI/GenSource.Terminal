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
  const jsonKey = provider.apiKey.trim();

  const [exists, setExists] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(isAgentVaultUnlocked());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState(jsonKey);
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

  const persistModelOnly = useCallback(
    (model: string) => {
      onChange({
        ...config,
        activeProvider: "gemini",
        providers: {
          ...config.providers,
          gemini: {
            apiKey: unlocked ? "" : jsonKey,
            model,
          },
        },
      });
    },
    [config, onChange],
  );

  const persistClearedJsonKey = useCallback(() => {
    onChange({
      ...config,
      activeProvider: "gemini",
      providers: {
        ...config.providers,
        gemini: {
          apiKey: "",
          model: provider.model,
        },
      },
    });
  }, [config, onChange, provider.model]);

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
      persistClearedJsonKey();
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
  }, [apiKeyDraft, confirmPassword, password, persistClearedJsonKey]);

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
      if (jsonKey) {
        persistClearedJsonKey();
      }
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
  }, [jsonKey, password, persistClearedJsonKey]);

  const handleSaveKey = useCallback(async () => {
    if (!apiKeyDraft.trim()) {
      setError("API key is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveVaultApiKey(apiKeyDraft.trim());
      persistClearedJsonKey();
      setStatus("API key saved to the vault.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save key");
    } finally {
      setBusy(false);
    }
  }, [apiKeyDraft, persistClearedJsonKey]);

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
            disabled={!unlocked && exists !== false}
            onChange={(event) => persistModelOnly(event.target.value)}
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
            hint="First run — you will need this each session"
            htmlFor="config-agent-vault-password"
            layout="stack"
          >
            <input
              id="config-agent-vault-password"
              className="config-form__control"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </ConfigRow>
          <ConfigRow
            label="Confirm"
            htmlFor="config-agent-vault-confirm"
            layout="stack"
          >
            <input
              id="config-agent-vault-confirm"
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
            htmlFor="config-agent-unlock"
            layout="stack"
          >
            <input
              id="config-agent-unlock"
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
            htmlFor="config-agent-api-key-edit"
            layout="stack"
          >
            <input
              id="config-agent-api-key-edit"
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
