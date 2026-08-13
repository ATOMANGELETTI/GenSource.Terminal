import { useState } from "react";

import type { Keybinding } from "../../../types";

interface KeyboardPageProps {
  bindings: Keybinding[];
  onUpdate: (id: string, patch: Partial<Keybinding>) => void;
  onCommitShortcut: (id: string, shortcut: string) => void;
}

export default function KeyboardPage({
  bindings,
  onUpdate,
  onCommitShortcut,
}: KeyboardPageProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (bindings.length === 0) {
    return (
      <p className="config-form__note">No keybindings loaded.</p>
    );
  }

  return (
    <div className="config-form">
      <p className="config-form__note">
        Global shortcuts need an app restart after changes. Local shortcut
        handlers load once at window start — reopen the app window to pick up
        edits.
      </p>
      <div className="config-keys" role="list">
        {bindings.map((binding) => {
          const draft =
            drafts[binding.id] !== undefined
              ? drafts[binding.id]
              : binding.shortcut;
          return (
            <div
              key={binding.id}
              className="config-keys__row"
              role="listitem"
            >
              <div className="config-keys__meta">
                <span className="config-keys__id">{binding.id}</span>
                <span className="config-keys__scope">{binding.scope}</span>
              </div>
              <input
                className="config-form__control config-keys__shortcut"
                type="text"
                aria-label={`${binding.id} shortcut`}
                value={draft}
                onChange={(event) => {
                  const value = event.target.value;
                  setDrafts((prev) => ({ ...prev, [binding.id]: value }));
                }}
                onBlur={(event) => {
                  const value = event.target.value;
                  setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[binding.id];
                    return next;
                  });
                  onCommitShortcut(binding.id, value);
                }}
              />
              <label className="config-keys__enabled">
                <input
                  type="checkbox"
                  className="config-form__checkbox"
                  checked={binding.enabled}
                  onChange={(event) =>
                    onUpdate(binding.id, { enabled: event.target.checked })
                  }
                />
                <span>On</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
