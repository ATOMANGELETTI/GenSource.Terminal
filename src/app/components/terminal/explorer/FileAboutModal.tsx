import type { FsEntryInfo } from "../../../types";
import { kindLabel } from "./fileTypeIcon";

interface FileAboutModalProps {
  info: FsEntryInfo;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function formatSize(size: number | null | undefined): string {
  if (size == null || Number.isNaN(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatModified(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function FileAboutModal({
  info,
  loading,
  error,
  onClose,
}: FileAboutModalProps) {
  return (
    <div className="file-about__backdrop" onClick={onClose}>
      <div
        className="file-about"
        role="dialog"
        aria-modal="true"
        aria-label={`About ${info.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="file-about__title">{info.name}</h2>
        {loading ? (
          <p className="file-about__muted">Loading details…</p>
        ) : null}
        {error ? <p className="file-about__error">{error}</p> : null}
        <dl className="file-about__grid">
          <div className="file-about__row">
            <dt>Type</dt>
            <dd>{kindLabel(info.kind)}</dd>
          </div>
          <div className="file-about__row">
            <dt>Path</dt>
            <dd title={info.path}>{info.path}</dd>
          </div>
          {info.kind === "file" ? (
            <div className="file-about__row">
              <dt>Size</dt>
              <dd>{formatSize(info.size)}</dd>
            </div>
          ) : null}
          <div className="file-about__row">
            <dt>Modified</dt>
            <dd>{formatModified(info.modified)}</dd>
          </div>
          {info.extension ? (
            <div className="file-about__row">
              <dt>Extension</dt>
              <dd>.{info.extension.replace(/^\./, "")}</dd>
            </div>
          ) : null}
        </dl>
        <button type="button" className="file-about__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
