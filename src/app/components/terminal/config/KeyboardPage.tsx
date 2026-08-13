import { useState } from "react";

import type { Keybinding } from "../../../types";
import { ConfigCard, ConfigRow, ConfigSwitch } from "./ConfigField";

interface KeyboardPageProps {
  bindings: Keybinding[];
  onUpdate: (id: string, patch: Partial<Keybinding>) => void;
  onCommitShortcut: (id: string, shortcut: string) => void;
}

function humanizeBindingId(id: string): string {
  const parts = id.split(".");
  const action = parts[parts.length - 1] ?? id;
  const scope = parts.length > 1 ? parts[0] : "";
  const actionLabel = action
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]/g, " ")
    .toLowerCase();
  const titled = actionLabel.replace(/\b\w/g, (char) => char.toUpperCase());
  if (!scope || titled.toLowerCase().includes(scope.toLowerCase())) {
    return titled;
  }
  return `${titled} ${scope.charAt(0).toUpperCase()}${scope.slice(1)}`;
}

export default function KeyboardPage({
  bindings,
  onUpdate,
  onCommitShortcut,
}: KeyboardPageProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (bindings.length === 0) {
    return <p className="config-form__note">No keybindings loaded.</p>;
  }

  const globalBindings = bindings.filter((binding) => binding.scope === "global");
  const localBindings = bindings.filter((binding) => binding.scope !== "global");

  const renderBinding = (binding: Keybinding) => {
    const draft =
      drafts[binding.id] !== undefined ? drafts[binding.id] : binding.shortcut;
    const title = humanizeBindingId(binding.id);
    return (
      <ConfigRow
        key={binding.id}
        label={title}
        hint={binding.id}
        htmlFor={`config-key-${binding.id}`}
        layout="stack"
      >
        <div className="config-keys__controls">
          <input
            id={`config-key-${binding.id}`}
            className="config-form__control config-keys__shortcut"
            type="text"
            aria-label={`${title} shortcut`}
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
          <ConfigSwitch
            id={`config-key-enabled-${binding.id}`}
            label={`Enable ${title}`}
            checked={binding.enabled}
            onChange={(checked) => onUpdate(binding.id, { enabled: checked })}
          />
        </div>
      </ConfigRow>
    );
  };

  return (
    <>
      <p className="config-form__note">
        Global shortcuts need an app restart after changes. Local handlers load
        once at window start — reopen the window to pick up edits.
      </p>
      {globalBindings.length > 0 ? (
        <ConfigCard label="Global">{globalBindings.map(renderBinding)}</ConfigCard>
      ) : null}
      {localBindings.length > 0 ? (
        <ConfigCard label="Local">{localBindings.map(renderBinding)}</ConfigCard>
      ) : null}
    </>
  );
}
