import { useCallback, useEffect, useRef, useState } from "react";

import { BotIcon, ChatIcon, HistoryIcon } from "../../icons/MenuIcons";
import {
  CHAT_STORE_KEY,
  createConversation,
  fetchAgentConfig,
  fetchDevEnvSecrets,
  importLegacyMessages,
  listConversations,
  saveAgentConfig,
  stripAgentApiKeys,
  subscribeAgentConfigChanges,
} from "../../../lib/agent";
import { autoUnlockAgentVault } from "../../../lib/agent-vault";
import { deleteStoreValue, getStoreValue } from "../../../lib/app-store";
import type {
  AgentChatMessage,
  AgentConfig,
  AgentDevEnvSecrets,
  AgentTerminalContext,
} from "../../../types";
import AgentPanel from "./AgentPanel";
import AgentsPage from "./AgentsPage";
import PreviousChats from "./PreviousChats";

const AGENT_VIEW_STORAGE_KEY = "gensource.agent.view";
const AGENT_CONVERSATION_STORAGE_KEY = "gensource.agent.conversationId";
const SAVE_DEBOUNCE_MS = 300;

type AgentView = "chat" | "history" | "settings";

interface AgentShellProps {
  terminal?: AgentTerminalContext | null;
}

function isAgentView(value: string): value is AgentView {
  return value === "chat" || value === "history" || value === "settings";
}

function readStoredView(): AgentView {
  try {
    const stored = sessionStorage.getItem(AGENT_VIEW_STORAGE_KEY);
    if (stored && isAgentView(stored)) return stored;
  } catch {
    // sessionStorage unavailable
  }
  return "chat";
}

function readStoredConversationId(): string | null {
  try {
    return sessionStorage.getItem(AGENT_CONVERSATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function AgentShell({ terminal }: AgentShellProps) {
  const [view, setView] = useState<AgentView>(readStoredView);
  const [conversationId, setConversationId] = useState<string | null>(
    readStoredConversationId,
  );
  const [ready, setReady] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [envSecrets, setEnvSecrets] = useState<AgentDevEnvSecrets>({
    vaultPassword: "",
    geminiApiKey: "",
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const agentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipExternalAgent = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(AGENT_VIEW_STORAGE_KEY, view);
    } catch {
      // sessionStorage unavailable
    }
  }, [view]);

  useEffect(() => {
    if (!conversationId) return;
    try {
      sessionStorage.setItem(AGENT_CONVERSATION_STORAGE_KEY, conversationId);
    } catch {
      // sessionStorage unavailable
    }
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (agentTimer.current) clearTimeout(agentTimer.current);
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void subscribeAgentConfigChanges((next) => {
      if (!cancelled && !skipExternalAgent.current) setAgentConfig(next);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [config, secrets, existing, stored] = await Promise.all([
          fetchAgentConfig().catch(() => null),
          fetchDevEnvSecrets().catch(
            (): AgentDevEnvSecrets => ({ vaultPassword: "", geminiApiKey: "" }),
          ),
          listConversations(),
          getStoreValue<AgentChatMessage[]>(CHAT_STORE_KEY),
        ]);
        if (cancelled) return;

        if (config) setAgentConfig(config);
        setEnvSecrets(secrets);

        const jsonKey =
          config?.providers.gemini?.apiKey?.trim() ||
          config?.providers[config.activeProvider]?.apiKey?.trim() ||
          "";
        const unlock = await autoUnlockAgentVault({
          jsonVaultPassword: config?.vaultPassword?.trim() ?? "",
          jsonApiKey: jsonKey,
          envVaultPassword: secrets.vaultPassword,
          envGeminiApiKey: secrets.geminiApiKey,
        });
        if (cancelled) return;
        if (unlock.shouldClearJsonKey && config) {
          try {
            const saved = await saveAgentConfig(stripAgentApiKeys(config));
            if (!cancelled) setAgentConfig(saved);
          } catch (err) {
            console.warn("could not clear leftover agent.json apiKey", err);
          }
        }

        if (existing.length === 0 && Array.isArray(stored) && stored.length > 0) {
          const imported = await importLegacyMessages(stored);
          await deleteStoreValue(CHAT_STORE_KEY);
          if (!cancelled) setConversationId(imported.id);
        } else {
          if (Array.isArray(stored) && stored.length > 0 && existing.length > 0) {
            await deleteStoreValue(CHAT_STORE_KEY);
          }
          const remembered = readStoredConversationId();
          const match = remembered
            ? existing.find((item) => item.id === remembered)
            : undefined;
          if (match) {
            if (!cancelled) setConversationId(match.id);
          } else if (existing[0]) {
            if (!cancelled) setConversationId(existing[0].id);
          } else {
            const created = await createConversation();
            if (!cancelled) setConversationId(created.id);
          }
        }
      } catch (err) {
        console.warn("agent chat bootstrap failed", err);
        try {
          const created = await createConversation();
          if (!cancelled) setConversationId(created.id);
        } catch {
          // keep empty
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistAgent = useCallback(async (next: AgentConfig) => {
    skipExternalAgent.current = true;
    try {
      const saved = await saveAgentConfig(next);
      setAgentConfig(saved);
      setSaveError(null);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save agent config";
      setSaveError(message);
      console.warn("save_agent_config failed", error);
    } finally {
      window.setTimeout(() => {
        skipExternalAgent.current = false;
      }, 400);
    }
  }, []);

  const scheduleAgentSave = useCallback(
    (next: AgentConfig) => {
      if (agentTimer.current) clearTimeout(agentTimer.current);
      agentTimer.current = setTimeout(() => {
        void persistAgent(next);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistAgent],
  );

  const updateAgentConfig = useCallback(
    (next: AgentConfig) => {
      setAgentConfig((prev) => {
        if (prev && deepEqual(prev, next)) return prev;
        scheduleAgentSave(next);
        return next;
      });
    },
    [scheduleAgentSave],
  );

  const handleNewChat = useCallback(async () => {
    const created = await createConversation();
    setConversationId(created.id);
    setView("chat");
  }, []);

  const handleOpen = useCallback((id: string) => {
    setConversationId(id);
    setView("chat");
  }, []);

  const handleDeleted = useCallback(
    (id: string) => {
      if (conversationId !== id) return;
      void (async () => {
        const remaining = await listConversations();
        if (remaining[0]) {
          setConversationId(remaining[0].id);
        } else {
          const created = await createConversation();
          setConversationId(created.id);
        }
      })();
    },
    [conversationId],
  );

  const openSettings = useCallback(() => {
    setView("settings");
  }, []);

  return (
    <div className="agent-shell" data-testid="agent-shell">
      <nav className="agent-panel__rail" aria-label="Agent views">
        <button
          type="button"
          className={
            view === "chat"
              ? "agent-panel__rail-btn agent-panel__rail-btn--active"
              : "agent-panel__rail-btn"
          }
          aria-label="Chat"
          title="Chat"
          aria-current={view === "chat" ? "page" : undefined}
          onClick={() => setView("chat")}
        >
          <ChatIcon className="agent-panel__rail-icon" />
        </button>
        <button
          type="button"
          className={
            view === "history"
              ? "agent-panel__rail-btn agent-panel__rail-btn--active"
              : "agent-panel__rail-btn"
          }
          aria-label="Previous chats"
          title="Previous chats"
          aria-current={view === "history" ? "page" : undefined}
          onClick={() => setView("history")}
        >
          <HistoryIcon className="agent-panel__rail-icon" />
        </button>
        <button
          type="button"
          className={
            view === "settings"
              ? "agent-panel__rail-btn agent-panel__rail-btn--active"
              : "agent-panel__rail-btn"
          }
          aria-label="Agent settings"
          title="Agent settings"
          aria-current={view === "settings" ? "page" : undefined}
          onClick={() => setView("settings")}
        >
          <BotIcon className="agent-panel__rail-icon" />
        </button>
      </nav>
      <div className="agent-shell__main">
        {view === "settings" ? (
          <div className="agent-settings" data-testid="agent-settings">
            <header className="config-panel__header">
              <h2 className="config-panel__title">Agent settings</h2>
              <p className="config-panel__subtitle">
                Gemini provider and Stronghold vault
              </p>
            </header>
            <div className="config-panel__body">
              {saveError ? (
                <p className="config-panel__status config-panel__status--error">
                  {saveError}
                </p>
              ) : null}
              {agentConfig ? (
                <AgentsPage
                  config={agentConfig}
                  onChange={updateAgentConfig}
                  envVaultPassword={envSecrets.vaultPassword}
                  envGeminiApiKey={envSecrets.geminiApiKey}
                />
              ) : (
                <p className="config-form__note">Loading agent settings…</p>
              )}
            </div>
          </div>
        ) : view === "history" ? (
          <PreviousChats
            activeId={conversationId}
            onOpen={handleOpen}
            onDeleted={handleDeleted}
          />
        ) : ready && conversationId ? (
          <AgentPanel
            conversationId={conversationId}
            terminal={terminal}
            onOpenSettings={openSettings}
            onNewChat={() => void handleNewChat()}
          />
        ) : (
          <div className="agent-panel">
            <p className="agent-panel__hint">Loading chats…</p>
          </div>
        )}
      </div>
    </div>
  );
}
