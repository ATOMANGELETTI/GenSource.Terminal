import { useCallback, useEffect, useState } from "react";

import {
  deleteConversation,
  formatRelativeTime,
  listConversations,
  renameConversation,
} from "../../../lib/agent";
import type { AgentConversation } from "../../../types";

interface PreviousChatsProps {
  activeId: string | null;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
}

export default function PreviousChats({
  activeId,
  onOpen,
  onDeleted,
}: PreviousChatsProps) {
  const [items, setItems] = useState<AgentConversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const refresh = useCallback(async () => {
    try {
      setItems(await listConversations());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, activeId]);

  const handleRename = useCallback(
    async (id: string) => {
      const title = renameDraft.trim();
      if (!title) return;
      try {
        await renameConversation(id, title);
        setRenamingId(null);
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Rename failed");
      }
    },
    [refresh, renameDraft],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
        onDeleted(id);
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [onDeleted, refresh],
  );

  return (
    <div className="agent-history" data-testid="agent-history">
      <header className="agent-panel__header">
        <div className="agent-panel__title-wrap">
          <h2 className="agent-panel__title">Previous chats</h2>
          <p className="agent-panel__subtitle">Newest first</p>
        </div>
      </header>
      <div className="agent-history__list">
        {error ? (
          <p className="agent-panel__error" role="alert">
            {error}
          </p>
        ) : null}
        {items.length === 0 ? (
          <p className="agent-panel__hint">No saved chats yet.</p>
        ) : null}
        {items.map((item) => {
          const active = item.id === activeId;
          const renaming = renamingId === item.id;
          return (
            <div
              key={item.id}
              className={
                active
                  ? "agent-history__row agent-history__row--active"
                  : "agent-history__row"
              }
            >
              {renaming ? (
                <form
                  className="agent-history__rename"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRename(item.id);
                  }}
                >
                  <input
                    className="agent-history__rename-input"
                    value={renameDraft}
                    autoFocus
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                  />
                  <button type="submit" className="agent-panel__btn">
                    Save
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="agent-history__open"
                  onClick={() => onOpen(item.id)}
                >
                  <span className="agent-history__title">{item.title}</span>
                  <span className="agent-history__time">
                    {formatRelativeTime(item.updatedAt)}
                  </span>
                </button>
              )}
              <div className="agent-history__actions">
                <button
                  type="button"
                  className="agent-panel__btn"
                  onClick={() => {
                    setRenamingId(item.id);
                    setRenameDraft(item.title);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="agent-panel__btn"
                  onClick={() => void handleDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
