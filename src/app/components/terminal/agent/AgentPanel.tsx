import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import {
  agentChatCancel,
  agentChatClear,
  agentChatLoad,
  agentChatSend,
  agentConfirmResponse,
  agentHasApiKey,
  appendConfirmMessage,
  applyAgentChunk,
  expirePendingConfirmMessages,
  getConversationMessages,
  mergeAssistantReply,
  resolveConfirmMessage,
  subscribeAgentChunk,
  subscribeAgentConfirm,
  subscribeAgentDone,
  subscribeAgentError,
  subscribeAgentTool,
} from "../../../lib/agent";
import type {
  AgentChatMessage,
  AgentConfirmDecision,
  AgentTerminalContext,
} from "../../../types";

interface AgentPanelProps {
  conversationId: string;
  terminal?: AgentTerminalContext | null;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function confirmStatusClass(
  decision: AgentConfirmDecision | undefined,
): string {
  if (!decision) return "agent-panel__confirm";
  return `agent-panel__confirm agent-panel__confirm--${decision}`;
}

function confirmTitle(message: AgentChatMessage): string {
  const tool = message.toolName ?? "tool";
  if (message.confirmDecision === "allowed") return `Allowed ${tool}`;
  if (message.confirmDecision === "denied") return `Denied ${tool}`;
  if (message.confirmDecision === "expired") return `Expired ${tool}`;
  return "Allow tool?";
}

export default function AgentPanel({
  conversationId,
  terminal,
  onOpenSettings,
  onNewChat,
}: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const streamingId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setMessages([]);
    setError(null);
    setBusy(false);
    streamingId.current = null;
    void (async () => {
      try {
        const [keyOk, stored] = await Promise.all([
          agentHasApiKey(),
          conversationId
            ? getConversationMessages(conversationId)
            : Promise.resolve([]),
        ]);
        if (conversationId) {
          await agentChatLoad(conversationId);
        }
        if (cancelled) return;
        setHasKey(keyOk);
        setMessages(expirePendingConfirmMessages(stored));
      } catch {
        if (!cancelled) setHasKey(false);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      const u1 = await subscribeAgentChunk((event) => {
        if (event.conversationId !== conversationId) return;
        setMessages((prev) => {
          const next = applyAgentChunk(
            prev,
            event.text,
            streamingId.current,
            createId,
          );
          streamingId.current = next.streamingId;
          return next.messages;
        });
      });
      const u2 = await subscribeAgentTool((event) => {
        if (event.conversationId !== conversationId) return;
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "tool",
            content: event.detail?.trim() || event.status,
            toolName: event.name,
            toolStatus: event.status,
          },
        ]);
      });
      const u3 = await subscribeAgentDone((event) => {
        if (event.conversationId !== conversationId) return;
        setBusy(false);
      });
      const u4 = await subscribeAgentError((event) => {
        if (event.conversationId !== conversationId) return;
        streamingId.current = null;
        setBusy(false);
        setError(event.message);
        setMessages((prev) => expirePendingConfirmMessages(prev));
      });
      const u5 = await subscribeAgentConfirm((event) => {
        if (event.conversationId !== conversationId) return;
        setMessages((prev) => appendConfirmMessage(prev, event, createId));
      });
      if (cancelled) {
        u1();
        u2();
        u3();
        u4();
        u5();
        return;
      }
      unlisteners.push(u1, u2, u3, u4, u5);
    })();

    return () => {
      cancelled = true;
      for (const stop of unlisteners) stop();
    };
  }, [conversationId]);

  const refreshKey = useCallback(async () => {
    try {
      setHasKey(await agentHasApiKey());
    } catch {
      setHasKey(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy || !conversationId) return;
    setError(null);
    setDraft("");
    setBusy(true);
    streamingId.current = null;
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", content: text },
    ]);

    try {
      const reply = await agentChatSend({
        conversationId,
        message: text,
        sessionId: terminal?.sessionId ?? null,
        cwd: terminal?.cwd ?? null,
        recentOutput: terminal?.getRecentOutput(8000) ?? null,
      });
      const streamed = streamingId.current;
      const visible = reply?.trim() ?? "";
      if (visible) {
        setMessages((prev) =>
          mergeAssistantReply(prev, visible, streamed, createId),
        );
      } else if (!streamed) {
        setError("The model returned no visible text.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Send failed";
      setError(message);
      void refreshKey();
    } finally {
      streamingId.current = null;
      setBusy(false);
    }
  }, [busy, conversationId, draft, refreshKey, terminal]);

  const handleCancel = useCallback(() => {
    if (!conversationId) return;
    void agentChatCancel(conversationId);
  }, [conversationId]);

  const handleClear = useCallback(() => {
    if (!conversationId) return;
    void agentChatClear(conversationId);
    streamingId.current = null;
    setMessages([]);
    setError(null);
    setBusy(false);
  }, [conversationId]);

  const handleConfirm = useCallback(
    async (requestId: string, approved: boolean) => {
      const decision: AgentConfirmDecision = approved ? "allowed" : "denied";
      setMessages((prev) => resolveConfirmMessage(prev, requestId, decision));
      try {
        await agentConfirmResponse(requestId, approved);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Confirm failed");
      }
    },
    [],
  );

  if (hasKey === false) {
    return (
      <div className="agent-panel" data-testid="agent-panel">
        <div className="agent-panel__empty">
          <p className="agent-panel__empty-title">Gemini API key required</p>
          <p className="agent-panel__empty-body">
            Unlock or create the vault in Agents settings. The key stays in
            Stronghold and Rust — the chat UI never calls Google directly.
          </p>
          {onOpenSettings ? (
            <button
              type="button"
              className="agent-panel__btn agent-panel__btn--primary"
              onClick={onOpenSettings}
            >
              Open Agents settings
            </button>
          ) : null}
          <button
            type="button"
            className="agent-panel__btn"
            onClick={() => void refreshKey()}
          >
            Recheck key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-panel" data-testid="agent-panel">
      <header className="agent-panel__header">
        <div className="agent-panel__title-wrap">
          <h2 className="agent-panel__title">Chat</h2>
          <p className="agent-panel__subtitle">
            {terminal?.cwd
              ? `cwd ${terminal.cwd}`
              : terminal?.sessionId
                ? "Terminal linked"
                : "No active terminal"}
          </p>
        </div>
        <div className="agent-panel__header-actions">
          {busy ? (
            <button
              type="button"
              className="agent-panel__btn"
              onClick={handleCancel}
            >
              Cancel
            </button>
          ) : null}
          {onNewChat ? (
            <button
              type="button"
              className="agent-panel__btn"
              onClick={onNewChat}
              disabled={busy}
            >
              New chat
            </button>
          ) : null}
          <button
            type="button"
            className="agent-panel__btn"
            onClick={handleClear}
            disabled={(busy && !messages.length) || !hydrated}
          >
            Clear
          </button>
        </div>
      </header>

      <div className="agent-panel__messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="agent-panel__hint">
            Ask about the terminal, files, git, or settings. Tools run in Rust.
          </p>
        ) : null}
        {messages.map((message) => {
          if (message.role === "tool") {
            return (
              <div
                key={message.id}
                className="agent-panel__tool-chip"
                title={message.content}
              >
                <span className="agent-panel__tool-name">
                  {message.toolName}
                </span>
                <span className="agent-panel__tool-status">
                  {message.toolStatus}
                </span>
              </div>
            );
          }
          if (message.role === "confirm") {
            const pending = !message.confirmDecision;
            const requestId = message.confirmRequestId;
            return (
              <div
                key={message.id}
                className={confirmStatusClass(message.confirmDecision)}
              >
                <p className="agent-panel__confirm-title">
                  {confirmTitle(message)}
                </p>
                <p className="agent-panel__confirm-body">
                  {pending ? (
                    <>
                      <strong>{message.toolName}</strong> — {message.content}
                    </>
                  ) : (
                    message.content
                  )}
                </p>
                {pending && requestId ? (
                  <div className="agent-panel__confirm-actions">
                    <button
                      type="button"
                      className="agent-panel__btn"
                      onClick={() => void handleConfirm(requestId, false)}
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      className="agent-panel__btn agent-panel__btn--primary"
                      onClick={() => void handleConfirm(requestId, true)}
                    >
                      Allow
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "agent-panel__msg agent-panel__msg--user"
                  : "agent-panel__msg agent-panel__msg--assistant"
              }
            >
              {message.role === "assistant" ? (
                <div className="agent-panel__markdown">
                  <Markdown>{message.content || "…"}</Markdown>
                </div>
              ) : (
                <p className="agent-panel__msg-text">{message.content}</p>
              )}
            </div>
          );
        })}
        {busy && messages.at(-1)?.role === "user" ? (
          <div
            className="agent-panel__msg agent-panel__msg--assistant"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="agent-panel__msg-text">…</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="agent-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="agent-panel__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <textarea
          className="agent-panel__input"
          rows={3}
          value={draft}
          placeholder="Message the agent…"
          disabled={busy || hasKey === null || !conversationId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <button
          type="submit"
          className="agent-panel__btn agent-panel__btn--primary agent-panel__send"
          disabled={busy || !draft.trim() || hasKey === null || !conversationId}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
