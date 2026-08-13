import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import {
  agentChatCancel,
  agentChatClear,
  agentChatSend,
  agentConfirmResponse,
  agentHasApiKey,
  applyAgentChunk,
  CHAT_STORE_KEY,
  mergeAssistantReply,
  subscribeAgentChunk,
  subscribeAgentConfirm,
  subscribeAgentDone,
  subscribeAgentError,
  subscribeAgentTool,
} from "../../../lib/agent";
import { getStoreValue, setStoreValue } from "../../../lib/app-store";
import type {
  AgentChatMessage,
  AgentConfirmEvent,
  AgentTerminalContext,
} from "../../../types";

const DEFAULT_CONVERSATION_ID = "main";

interface AgentPanelProps {
  terminal?: AgentTerminalContext | null;
  onOpenAgentsConfig?: () => void;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AgentPanel({
  terminal,
  onOpenAgentsConfig,
}: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AgentConfirmEvent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const streamingId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [keyOk, stored] = await Promise.all([
          agentHasApiKey(),
          getStoreValue<AgentChatMessage[]>(CHAT_STORE_KEY),
        ]);
        if (cancelled) return;
        setHasKey(keyOk);
        if (Array.isArray(stored) && stored.length > 0) {
          setMessages(stored);
        }
      } catch {
        if (!cancelled) setHasKey(false);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void setStoreValue(CHAT_STORE_KEY, messages);
  }, [messages, hydrated]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy, confirm]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let cancelled = false;

    void (async () => {
      const u1 = await subscribeAgentChunk((event) => {
        if (event.conversationId !== DEFAULT_CONVERSATION_ID) return;
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
        if (event.conversationId !== DEFAULT_CONVERSATION_ID) return;
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
        if (event.conversationId !== DEFAULT_CONVERSATION_ID) return;
        setBusy(false);
      });
      const u4 = await subscribeAgentError((event) => {
        if (event.conversationId !== DEFAULT_CONVERSATION_ID) return;
        streamingId.current = null;
        setBusy(false);
        setError(event.message);
      });
      const u5 = await subscribeAgentConfirm((event) => {
        if (event.conversationId !== DEFAULT_CONVERSATION_ID) return;
        setConfirm(event);
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
  }, []);

  const refreshKey = useCallback(async () => {
    try {
      setHasKey(await agentHasApiKey());
    } catch {
      setHasKey(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
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
        conversationId: DEFAULT_CONVERSATION_ID,
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
  }, [busy, draft, refreshKey, terminal]);

  const handleCancel = useCallback(() => {
    void agentChatCancel(DEFAULT_CONVERSATION_ID);
  }, []);

  const handleClear = useCallback(() => {
    void agentChatClear(DEFAULT_CONVERSATION_ID);
    streamingId.current = null;
    setMessages([]);
    setError(null);
    setConfirm(null);
    setBusy(false);
  }, []);

  const handleConfirm = useCallback(async (approved: boolean) => {
    if (!confirm) return;
    const requestId = confirm.requestId;
    setConfirm(null);
    try {
      await agentConfirmResponse(requestId, approved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    }
  }, [confirm]);

  if (hasKey === false) {
    return (
      <div className="agent-panel" data-testid="agent-panel">
        <div className="agent-panel__empty">
          <p className="agent-panel__empty-title">Gemini API key required</p>
          <p className="agent-panel__empty-body">
            Add your key in Config → Agents (saved to other/configs/agent.json).
            Keys stay in Rust — the chat UI never calls Google directly.
          </p>
          {onOpenAgentsConfig ? (
            <button
              type="button"
              className="agent-panel__btn agent-panel__btn--primary"
              onClick={onOpenAgentsConfig}
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
          <h2 className="agent-panel__title">Agents</h2>
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
          <button
            type="button"
            className="agent-panel__btn"
            onClick={handleClear}
            disabled={busy && !messages.length}
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

      {confirm ? (
        <div className="agent-panel__confirm" role="dialog" aria-modal="true">
          <p className="agent-panel__confirm-title">Allow tool?</p>
          <p className="agent-panel__confirm-body">
            <strong>{confirm.tool}</strong> — {confirm.summary}
          </p>
          <div className="agent-panel__confirm-actions">
            <button
              type="button"
              className="agent-panel__btn"
              onClick={() => void handleConfirm(false)}
            >
              Deny
            </button>
            <button
              type="button"
              className="agent-panel__btn agent-panel__btn--primary"
              onClick={() => void handleConfirm(true)}
            >
              Allow
            </button>
          </div>
        </div>
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
          disabled={busy || hasKey === null}
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
          disabled={busy || !draft.trim() || hasKey === null}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
