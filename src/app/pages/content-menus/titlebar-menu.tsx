import { useEffect, useState } from "react";

import {
  CloseIcon,
  MaximizeIcon,
  MinimizeIcon,
  MoveIcon,
  ResizeIcon,
  RestoreIcon,
} from "../../components/icons/MenuIcons";
import { useKeybindingLabels } from "../../lib/keybindings";
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  moveWindow,
  toggleMaximize,
} from "../../lib/window";
import type { ContextMenuPosition } from "../../types";

interface TitlebarMenuProps extends ContextMenuPosition {
  onClose: () => void;
  /** When set (popup host), use these instead of calling window APIs here. */
  maximized?: boolean;
  onRestore?: () => void;
  onMove?: () => void;
  onMinimize?: () => void;
  onToggleMaximize?: () => void;
  onCloseWindow?: () => void;
}

export default function TitlebarMenu({
  x,
  y,
  onClose,
  maximized: maximizedProp,
  onRestore,
  onMove,
  onMinimize,
  onToggleMaximize,
  onCloseWindow,
}: TitlebarMenuProps) {
  const { label } = useKeybindingLabels();
  const [maximizedLocal, setMaximizedLocal] = useState(false);
  const useExternal = Boolean(onRestore || onMove || onMinimize || onToggleMaximize || onCloseWindow);
  const maximized = maximizedProp ?? maximizedLocal;

  useEffect(() => {
    if (useExternal || maximizedProp !== undefined) return;
    void isWindowMaximized().then(setMaximizedLocal);
  }, [useExternal, maximizedProp]);

  const run = (action: () => void | Promise<void>) => () => {
    void action();
    onClose();
  };

  return (
    <nav
      className="context-menu titlebar-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled={!maximized}
        onClick={run(onRestore ?? toggleMaximize)}
      >
        <RestoreIcon className="context-menu__icon" />
        <span className="context-menu__label">Restore</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onMove ?? moveWindow)}
      >
        <MoveIcon className="context-menu__icon" />
        <span className="context-menu__label">Move</span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        disabled
      >
        <ResizeIcon className="context-menu__icon" />
        <span className="context-menu__label">Size</span>
      </button>

      <div className="context-menu__separator" role="separator" />

      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onMinimize ?? minimizeWindow)}
      >
        <MinimizeIcon className="context-menu__icon" />
        <span className="context-menu__label">Toggle Window</span>
        <span className="context-menu__shortcut">
          {label("titlebar.toggleWindow")}
        </span>
      </button>
      <button
        type="button"
        className="context-menu__item"
        role="menuitem"
        onClick={run(onToggleMaximize ?? toggleMaximize)}
      >
        <MaximizeIcon className="context-menu__icon" />
        <span className="context-menu__label">Toggle Maximize</span>
        <span className="context-menu__shortcut">
          {label("titlebar.toggleMaximize")}
        </span>
      </button>

      <div className="context-menu__separator" role="separator" />

      <button
        type="button"
        className="context-menu__item context-menu__item--destructive"
        role="menuitem"
        onClick={run(onCloseWindow ?? closeWindow)}
      >
        <CloseIcon className="context-menu__icon" />
        <span className="context-menu__label">Close</span>
        <span className="context-menu__shortcut">{label("titlebar.close")}</span>
      </button>
    </nav>
  );
}
