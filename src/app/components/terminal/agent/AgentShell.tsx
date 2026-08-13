import { useCallback, useEffect, useState } from "react";

import { ChatIcon, HistoryIcon } from "../../icons/MenuIcons";
import { CHAT_STORE_KEY, createConversation, importLegacyMessages, listConversations } from "../../../lib/agent";
import { deleteStoreValue, getStoreValue } from "../../../lib/app-store";
import type { AgentChatMessage, AgentTerminalContext } from "../../../types";
import AgentPanel from "./AgentPanel";
import PreviousChats from "./PreviousChats";

const AGENT_VIEW_STORAGE_KEY = "gensource.agent.view";
const AGENT_CONVERSATION_STORAGE_KEY = "gensource.agent.conversationId";

type AgentView = "chat" | "history";

interface AgentShellProps {
  terminal?: AgentTerminalContext | null;
  onOpenAgentsConfig?: () => void;
}

function isAgentView(value: string): value is AgentView {
  return value === "chat" || value === "history";
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

export default function AgentShell({
  terminal,
  onOpenAgentsConfig,
}: AgentShellProps) {
  const [view, setView] = useState<AgentView>(readStoredView);
  const [conversationId, setConversationId] = useState<string | null>(
    readStoredConversationId,
  );
  const [ready, setReady] = useState(false);

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
    let cancelled = false;
    void (async () => {
      try {
        const existing = await listConversations();
        const stored = await getStoreValue<AgentChatMessage[]>(CHAT_STORE_KEY);
        if (cancelled) return;

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
      </nav>
      <div className="agent-shell__main">
        {view === "history" ? (
          <PreviousChats
            activeId={conversationId}
            onOpen={handleOpen}
            onDeleted={handleDeleted}
          />
        ) : ready && conversationId ? (
          <AgentPanel
            conversationId={conversationId}
            terminal={terminal}
            onOpenAgentsConfig={onOpenAgentsConfig}
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
