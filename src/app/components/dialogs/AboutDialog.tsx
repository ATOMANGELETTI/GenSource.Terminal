import type { AppInfo } from "../../types";

interface AboutDialogProps {
  info: AppInfo;
  onClose: () => void;
}

export default function AboutDialog({ info, onClose }: AboutDialogProps) {
  const productName = info.productName ?? info.name;

  return (
    <div className="about-dialog__backdrop" onClick={onClose}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`About ${productName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-dialog__icon" aria-hidden="true">
          {productName.charAt(0).toUpperCase()}
        </div>
        <h2 className="about-dialog__title">{productName}</h2>
        <p className="about-dialog__version">Version {info.version}</p>
        {info.description && (
          <p className="about-dialog__description">{info.description}</p>
        )}
        {info.publisher && (
          <p className="about-dialog__publisher">{info.publisher}</p>
        )}
        <button
          type="button"
          className="about-dialog__close"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
