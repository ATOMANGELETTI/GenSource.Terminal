import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { ChevronRightIcon } from "../../icons/MenuIcons";
import type { ExplorerDraft, FsEntry } from "../../../types";
import { fileTypeIcon } from "./fileTypeIcon";
import type { VisibleRow } from "./useFileTree";

interface FileTreeNodeProps {
  row: VisibleRow;
  selected: boolean;
  draft: ExplorerDraft | null;
  onSelect: (entry: FsEntry) => void;
  onActivate: (entry: FsEntry) => void;
  onContextMenu: (entry: FsEntry, x: number, y: number) => void;
  onDraftChange: (name: string) => void;
  onDraftCommit: () => void;
  onDraftCancel: () => void;
}

function isContainer(entry: FsEntry): boolean {
  return entry.kind === "drive" || entry.kind === "dir";
}

export default function FileTreeNode({
  row,
  selected,
  draft,
  onSelect,
  onActivate,
  onContextMenu,
  onDraftChange,
  onDraftCommit,
  onDraftCancel,
}: FileTreeNodeProps) {
  const { entry, depth, expanded, loading, pending, empty, error } = row;
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);
  const renaming =
    draft?.mode === "rename" &&
    draft.path &&
    draft.path.toLowerCase() === entry.path.toLowerCase();
  const creatingHere =
    draft != null &&
    draft.mode !== "rename" &&
    draft.parentPath.toLowerCase() === entry.path.toLowerCase() &&
    expanded;

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  useEffect(() => {
    if (!selected || renaming) return;
    rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected, renaming]);

  const handleClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onSelect(entry);
    if (isContainer(entry)) {
      onActivate(entry);
    }
  };

  const handleDoubleClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onSelect(entry);
    onActivate(entry);
  };

  const handleContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(entry);
    onContextMenu(entry, event.clientX, event.clientY);
  };

  const handleDraftKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipBlurRef.current = true;
      void onDraftCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      skipBlurRef.current = true;
      onDraftCancel();
    }
  };

  const handleDraftBlur = () => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    void onDraftCommit();
  };

  return (
    <>
      <div
        ref={rowRef}
        className={
          selected
            ? "file-tree-node file-tree-node--selected"
            : "file-tree-node"
        }
        style={{ paddingLeft: `${0.35 + depth * 0.75}rem` }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isContainer(entry) ? expanded : undefined}
        data-path={entry.path}
        title={entry.path}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      >
        <span
          className={
            isContainer(entry)
              ? expanded
                ? "file-tree-node__chevron file-tree-node__chevron--open"
                : "file-tree-node__chevron"
              : "file-tree-node__chevron file-tree-node__chevron--hidden"
          }
          aria-hidden="true"
        >
          <ChevronRightIcon />
        </span>
        {fileTypeIcon(entry)}
        {renaming && draft ? (
          <input
            ref={inputRef}
            className="file-tree-node__input"
            value={draft.draftName}
            aria-label="Rename"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={handleDraftBlur}
            onKeyDown={handleDraftKey}
          />
        ) : (
          <span className="file-tree-node__name" title={entry.path}>
            {entry.name}
          </span>
        )}
        {loading && !pending ? (
          <span className="file-tree-node__meta">…</span>
        ) : error ? (
          <span className="file-tree-node__meta file-tree-node__meta--error">
            !
          </span>
        ) : null}
      </div>
      {creatingHere && draft ? (
        <DraftRow
          depth={depth + 1}
          draft={draft}
          onDraftChange={onDraftChange}
          onDraftCommit={onDraftCommit}
          onDraftCancel={onDraftCancel}
        />
      ) : null}
      {expanded && pending ? (
        <div
          className="file-tree-node__status"
          style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
        >
          Loading…
        </div>
      ) : null}
      {expanded && error ? (
        <div
          className="file-tree-node__status file-tree-node__status--error"
          style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
        >
          {error}
        </div>
      ) : null}
      {expanded && empty && !creatingHere ? (
        <div
          className="file-tree-node__status"
          style={{ paddingLeft: `${1.1 + (depth + 1) * 0.75}rem` }}
        >
          Empty
        </div>
      ) : null}
    </>
  );
}

interface DraftRowProps {
  depth: number;
  draft: ExplorerDraft;
  onDraftChange: (name: string) => void;
  onDraftCommit: () => void;
  onDraftCancel: () => void;
}

function DraftRow({
  depth,
  draft,
  onDraftChange,
  onDraftCommit,
  onDraftCancel,
}: DraftRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      skipBlurRef.current = true;
      void onDraftCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      skipBlurRef.current = true;
      onDraftCancel();
    }
  };

  const handleBlur = () => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    void onDraftCommit();
  };

  const fake: FsEntry = {
    name: draft.draftName,
    path: `${draft.parentPath}\\${draft.draftName}`,
    kind: draft.mode === "create-dir" ? "dir" : "file",
  };

  return (
    <div
      className="file-tree-node file-tree-node--draft"
      style={{ paddingLeft: `${0.35 + depth * 0.75}rem` }}
    >
      <span
        className="file-tree-node__chevron file-tree-node__chevron--hidden"
        aria-hidden="true"
      >
        <ChevronRightIcon />
      </span>
      {fileTypeIcon(fake)}
      <input
        ref={inputRef}
        className="file-tree-node__input"
        value={draft.draftName}
        aria-label={
          draft.mode === "create-dir" ? "New folder name" : "New file name"
        }
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
      />
    </div>
  );
}
