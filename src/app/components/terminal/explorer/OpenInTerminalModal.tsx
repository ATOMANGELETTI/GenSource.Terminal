interface OpenInTerminalModalProps {
  onClose: () => void;
  onOpenTerminalTab: () => void;
}

export default function OpenInTerminalModal({
  onClose,
  onOpenTerminalTab,
}: OpenInTerminalModalProps) {
  return (
    <div className="file-about__backdrop" onClick={onClose}>
      <div
        className="file-about"
        role="dialog"
        aria-modal="true"
        aria-label="Open in Terminal"
        data-testid="open-in-terminal-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="file-about__title">Open in Terminal</h2>
        <p className="file-about__muted">
          A terminal tab must be open before changing directories.
        </p>
        <div className="file-about__actions">
          <button type="button" className="file-about__btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="file-about__btn file-about__btn--primary"
            onClick={onOpenTerminalTab}
          >
            Open Terminal Tab
          </button>
        </div>
      </div>
    </div>
  );
}
