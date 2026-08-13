import {
  AboutIcon,
  ClearIcon,
  CloseTabIcon,
  CopyIcon,
  FindIcon,
  NewTabIcon,
  PasteIcon,
  PinIcon,
  PreferencesIcon,
  ReloadIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomResetIcon,
} from "../../components/icons/MenuIcons";
import { copySelection, pasteAtFocus } from "../../lib/clipboard";
import { useKeybindingLabels } from "../../lib/keybindings";
import { zoomIn, zoomOut, zoomReset } from "../../lib/zoom";
import type { ContextMenuPosition } from "../../types";
import { invoke } from "@tauri-apps/api/core";

/** Optional terminal actions; Track D wires these to TerminalWorkspace. */
export interface ContentAreaTerminalActions {
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onTogglePin?: () => void;
  onSearch?: () => void;
  onClear?: () => void;
  /** When set, overrides default document copy (terminal selection precedence). */
  onCopy?: () => void;
  /** When set, overrides default paste (terminal-focused paste). */
  onPaste?: () => void;
}

interface ContentAreaMenuProps extends ContextMenuPosition {
  productName: string;
  onClose: () => void;
  onAbout: () => void;
  /** Popup host overrides — run on main via events instead of locally. */
  onReload?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onPreferences?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  terminal?: ContentAreaTerminalActions;
}

export default function ContentAreaMenu({
  x,
  y,
  productName,
  onClose,
  onAbout,
  onReload,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onPreferences,
  onCopy,
  onPaste,
  terminal,
}: ContentAreaMenuProps) {
  const { label } = useKeybindingLabels();

  const run = (action: () => void | Promise<void>) => () => {
    void action();
    onClose();
  };

  const copy = onCopy ?? terminal?.onCopy ?? copySelection;
  const paste = onPaste ?? terminal?.onPaste ?? pasteAtFocus;

  return (
    <nav
      className="context-menu content-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onReload ?? (() => window.location.reload()))}
      >
        <ReloadIcon className="context-menu__icon" />
        <span className="context-menu__label">Reload</span>
        <span className="context-menu__shortcut">{label("content.reload")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onZoomIn ?? zoomIn)}
      >
        <ZoomInIcon className="context-menu__icon" />
        <span className="context-menu__label">Zoom In</span>
        <span className="context-menu__shortcut">{label("content.zoomIn")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onZoomOut ?? zoomOut)}
      >
        <ZoomOutIcon className="context-menu__icon" />
        <span className="context-menu__label">Zoom Out</span>
        <span className="context-menu__shortcut">{label("content.zoomOut")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onZoomReset ?? zoomReset)}
      >
        <ZoomResetIcon className="context-menu__icon" />
        <span className="context-menu__label">Reset Zoom</span>
        <span className="context-menu__shortcut">{label("content.zoomReset")}</span>
      </button>

      <div className="context-menu__separator" role="separator" />

      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!terminal?.onNewTab}
        onClick={run(() => terminal?.onNewTab?.())}
      >
        <NewTabIcon className="context-menu__icon" />
        <span className="context-menu__label">New Tab</span>
        <span className="context-menu__shortcut">
          {label("terminal.newTab")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!terminal?.onCloseTab}
        onClick={run(() => terminal?.onCloseTab?.())}
      >
        <CloseTabIcon className="context-menu__icon" />
        <span className="context-menu__label">Close Tab</span>
        <span className="context-menu__shortcut">
          {label("terminal.closeTab")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!terminal?.onTogglePin}
        onClick={run(() => terminal?.onTogglePin?.())}
      >
        <PinIcon className="context-menu__icon" />
        <span className="context-menu__label">Pin / Unpin</span>
        <span className="context-menu__shortcut">
          {label("terminal.togglePin")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!terminal?.onClear}
        onClick={run(() => terminal?.onClear?.())}
      >
        <ClearIcon className="context-menu__icon" />
        <span className="context-menu__label">Clear</span>
        <span className="context-menu__shortcut">
          {label("terminal.clear")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!terminal?.onSearch}
        onClick={run(() => terminal?.onSearch?.())}
      >
        <FindIcon className="context-menu__icon" />
        <span className="context-menu__label">Find</span>
        <span className="context-menu__shortcut">
          {label("terminal.search")}
        </span>
      </button>

      <div className="context-menu__separator" role="separator" />

      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(copy)}
      >
        <CopyIcon className="context-menu__icon" />
        <span className="context-menu__label">Copy</span>
        <span className="context-menu__shortcut">{label("content.copy")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(paste)}
      >
        <PasteIcon className="context-menu__icon" />
        <span className="context-menu__label">Paste</span>
        <span className="context-menu__shortcut">{label("content.paste")}</span>
      </button>

      <div className="context-menu__separator" role="separator" />

      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(
          onPreferences ?? (() => invoke("open_configs_folder")),
        )}
      >
        <PreferencesIcon className="context-menu__icon" />
        <span className="context-menu__label">Preferences</span>
        <span className="context-menu__shortcut">
          {label("content.preferences")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onAbout)}
      >
        <AboutIcon className="context-menu__icon" />
        <span className="context-menu__label">About {productName}</span>
      </button>
    </nav>
  );
}
