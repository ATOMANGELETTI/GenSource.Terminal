import {
  AboutIcon,
  CopyIcon,
  PasteIcon,
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

interface ContentAreaMenuProps extends ContextMenuPosition {
  productName: string;
  onClose: () => void;
  onAbout: () => void;
}

export default function ContentAreaMenu({
  x,
  y,
  productName,
  onClose,
  onAbout,
}: ContentAreaMenuProps) {
  const { label } = useKeybindingLabels();

  const run = (action: () => void | Promise<void>) => () => {
    void action();
    onClose();
  };

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
        onClick={run(() => window.location.reload())}
      >
        <ReloadIcon className="context-menu__icon" />
        <span className="context-menu__label">Reload</span>
        <span className="context-menu__shortcut">{label("content.reload")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(zoomIn)}
      >
        <ZoomInIcon className="context-menu__icon" />
        <span className="context-menu__label">Zoom In</span>
        <span className="context-menu__shortcut">{label("content.zoomIn")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(zoomOut)}
      >
        <ZoomOutIcon className="context-menu__icon" />
        <span className="context-menu__label">Zoom Out</span>
        <span className="context-menu__shortcut">{label("content.zoomOut")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(zoomReset)}
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
        onClick={run(copySelection)}
      >
        <CopyIcon className="context-menu__icon" />
        <span className="context-menu__label">Copy</span>
        <span className="context-menu__shortcut">{label("content.copy")}</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(pasteAtFocus)}
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
        onClick={run(() => invoke("open_configs_folder"))}
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
