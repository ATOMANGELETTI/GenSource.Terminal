import { PanelLeftIcon } from "../icons/MenuIcons";

interface StatusBarProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  shellName: string;
  cols: number;
  rows: number;
}

export default function StatusBar({
  panelOpen,
  onTogglePanel,
  shellName,
  cols,
  rows,
}: StatusBarProps) {
  return (
    <footer className="status-bar" data-testid="status-bar">
      <button
        type="button"
        className="status-bar__toggle"
        aria-pressed={panelOpen}
        aria-label="Toggle side panel"
        data-testid="status-bar-panel-toggle"
        onClick={onTogglePanel}
      >
        <PanelLeftIcon className="status-bar__toggle-icon" aria-hidden="true" />
      </button>
      <div className="status-bar__spacer" />
      <div className="status-bar__info" data-testid="status-bar-info">
        {shellName} · {cols}×{rows}
      </div>
    </footer>
  );
}
