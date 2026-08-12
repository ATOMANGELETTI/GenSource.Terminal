import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  errorMessage,
  formatFsError,
  fsCreateDir,
  fsCreateFile,
  fsEntryInfo,
  fsListDir,
  fsListDrives,
  fsOpenPath,
  fsRemove,
  fsRename,
  fsRevealPath,
  fsUsername,
} from '../../../lib/terminal/explorer-fs';
import type { ExplorerDraft, ExplorerDraftMode, FsEntry, FsEntryInfo } from '../../../types';

function normPath(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

function isCDrive(entry: FsEntry): boolean {
  const n = normPath(entry.path);
  return n === 'c:' || n === 'c:\\' || entry.name.toUpperCase().startsWith('C:');
}

function parentOf(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (idx <= 0) return trimmed;
  if (idx === 2 && trimmed[1] === ':') {
    return trimmed.slice(0, 3);
  }
  return trimmed.slice(0, idx);
}

function isContainer(entry: FsEntry | undefined): boolean {
  return entry?.kind === 'drive' || entry?.kind === 'dir';
}

export interface VisibleRow {
  entry: FsEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
  /** Expanded with no cached children yet — show a muted Loading row. */
  pending: boolean;
  empty: boolean;
  error?: string;
}

interface BuildVisibleRowsOptions {
  entries: FsEntry[];
  children: Record<string, FsEntry[]>;
  expanded: Set<string>;
  loadingPaths: Set<string>;
  errors: Record<string, string>;
  query: string;
}

export function buildVisibleRows({
  entries,
  children,
  expanded,
  loadingPaths,
  errors,
  query,
}: BuildVisibleRowsOptions): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const normalizedQuery = query.trim().toLowerCase();
  const filtering = normalizedQuery.length > 0;
  const descendantMatches = new Map<string, boolean>();
  const visiting = new Set<string>();

  const hasMatchingDescendant = (entry: FsEntry): boolean => {
    if (!filtering || !isContainer(entry)) return false;

    const key = normPath(entry.path);
    const cached = descendantMatches.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return false;

    visiting.add(key);
    const matches = (children[key] ?? []).some(
      (child) => child.name.toLowerCase().includes(normalizedQuery) || hasMatchingDescendant(child),
    );
    visiting.delete(key);
    descendantMatches.set(key, matches);
    return matches;
  };

  const walk = (currentEntries: FsEntry[], depth: number) => {
    for (const entry of currentEntries) {
      const key = normPath(entry.path);
      const matchesSelf = !filtering || entry.name.toLowerCase().includes(normalizedQuery);
      const revealsDescendant = hasMatchingDescendant(entry);

      if (!matchesSelf && !revealsDescendant) continue;

      const isExpanded = expanded.has(key);
      const rowExpanded = isExpanded || revealsDescendant;
      const loading = loadingPaths.has(key);
      const error = errors[key];
      const kids = children[key];
      const pending = isContainer(entry) && rowExpanded && loading && !Array.isArray(kids);
      const empty =
        !filtering &&
        isContainer(entry) &&
        rowExpanded &&
        !loading &&
        !error &&
        Array.isArray(kids) &&
        kids.length === 0;

      rows.push({
        entry,
        depth,
        expanded: rowExpanded,
        loading,
        pending,
        empty,
        error,
      });

      if (isContainer(entry) && rowExpanded && kids) {
        walk(kids, depth + 1);
      }
    }
  };

  walk(entries, 0);
  return rows;
}

export interface UseFileTreeResult {
  username: string;
  drives: FsEntry[];
  selectedPath: string | null;
  selectedEntry: FsEntry | null;
  searchOpen: boolean;
  searchQuery: string;
  draft: ExplorerDraft | null;
  aboutInfo: FsEntryInfo | null;
  aboutLoading: boolean;
  aboutError: string | null;
  rootError: string | null;
  rootLoading: boolean;
  visibleRows: VisibleRow[];
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  selectPath: (path: string | null) => void;
  toggleExpand: (entry: FsEntry) => void;
  expandPath: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  openEntry: (entry: FsEntry) => Promise<void>;
  revealEntry: (entry: FsEntry) => Promise<void>;
  copyPath: (entry: FsEntry) => Promise<void>;
  startCreate: (mode: 'create-file' | 'create-dir', parent?: FsEntry) => void;
  startRename: (entry: FsEntry) => void;
  setDraftName: (name: string) => void;
  cancelDraft: () => void;
  commitDraft: () => Promise<void>;
  deleteEntry: (entry: FsEntry) => Promise<boolean>;
  openAbout: (entry: FsEntry) => Promise<void>;
  closeAbout: () => void;
  targetDirForCreate: () => FsEntry | null;
  findEntry: (path: string) => FsEntry | undefined;
}

export function useFileTree(): UseFileTreeResult {
  const [username, setUsername] = useState('User');
  const [drives, setDrives] = useState<FsEntry[]>([]);
  const [children, setChildren] = useState<Record<string, FsEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(() => new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draft, setDraft] = useState<ExplorerDraft | null>(null);
  const [aboutInfo, setAboutInfo] = useState<FsEntryInfo | null>(null);
  const [aboutLoading, setAboutLoading] = useState(false);
  const [aboutError, setAboutError] = useState<string | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [rootLoading, setRootLoading] = useState(true);

  const childrenRef = useRef(children);
  const expandedRef = useRef(expanded);
  const drivesRef = useRef(drives);

  useEffect(() => {
    childrenRef.current = children;
  }, [children]);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);
  useEffect(() => {
    drivesRef.current = drives;
  }, [drives]);

  const entryIndex = useMemo(() => {
    const map = new Map<string, FsEntry>();
    for (const d of drives) map.set(normPath(d.path), d);
    for (const list of Object.values(children)) {
      for (const e of list) map.set(normPath(e.path), e);
    }
    return map;
  }, [drives, children]);

  const findEntry = useCallback((path: string) => entryIndex.get(normPath(path)), [entryIndex]);

  const selectedEntry = selectedPath ? (findEntry(selectedPath) ?? null) : null;

  const markLoading = useCallback((path: string, on: boolean) => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (on) next.add(normPath(path));
      else next.delete(normPath(path));
      return next;
    });
  }, []);

  const loadDir = useCallback(
    async (path: string, opts?: { force?: boolean }) => {
      const key = normPath(path);
      if (!opts?.force && childrenRef.current[key]) {
        return childrenRef.current[key];
      }
      markLoading(path, true);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        const entries = await fsListDir(path);
        setChildren((prev) => ({ ...prev, [key]: entries }));
        return entries;
      } catch (error) {
        const msg = formatFsError(error, 'Unable to list folder');
        setErrors((prev) => ({ ...prev, [key]: msg }));
        setChildren((prev) => ({ ...prev, [key]: [] }));
        return [];
      } finally {
        markLoading(path, false);
      }
    },
    [markLoading],
  );

  const expandPath = useCallback(
    async (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add(normPath(path));
        return next;
      });
      await loadDir(path);
    },
    [loadDir],
  );

  const toggleExpand = useCallback(
    (entry: FsEntry) => {
      if (!isContainer(entry)) return;
      const key = normPath(entry.path);
      const willExpand = !expandedRef.current.has(key);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (willExpand) next.add(key);
        else next.delete(key);
        return next;
      });
      if (willExpand) void loadDir(entry.path);
    },
    [loadDir],
  );

  const bootstrap = useCallback(async () => {
    setRootLoading(true);
    setRootError(null);
    try {
      const [user, driveList] = await Promise.all([
        fsUsername().catch(() => 'User'),
        fsListDrives(),
      ]);
      setUsername(user || 'User');
      setDrives(driveList);
      const cDrive =
        driveList.find(isCDrive) ?? driveList.find((d) => d.kind === 'drive') ?? driveList[0];
      if (cDrive) {
        setExpanded(new Set([normPath(cDrive.path)]));
        await loadDir(cDrive.path, { force: true });
        setSelectedPath(cDrive.path);
      }
    } catch (error) {
      setRootError(formatFsError(error, 'Unable to load drives'));
      setDrives([]);
    } finally {
      setRootLoading(false);
    }
  }, [loadDir]);

  useEffect(() => {
    void bootstrap();
    // Initial mount only — refresh() handles later reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    setRootLoading(true);
    setRootError(null);
    try {
      const driveList = await fsListDrives();
      setDrives(driveList);
      const expandedKeys = [...expandedRef.current];
      const nextChildren: Record<string, FsEntry[]> = {};
      await Promise.all(
        expandedKeys.map(async (key) => {
          const entry =
            driveList.find((d) => normPath(d.path) === key) ??
            Object.values(childrenRef.current)
              .flat()
              .find((e) => normPath(e.path) === key);
          const path = entry?.path ?? key;
          try {
            nextChildren[key] = await fsListDir(path);
          } catch (error) {
            nextChildren[key] = [];
            setErrors((prev) => ({
              ...prev,
              [key]: formatFsError(error, 'Unable to list folder'),
            }));
          }
        }),
      );
      setChildren(nextChildren);
      if (
        selectedPath &&
        !driveList.some((d) => normPath(d.path) === normPath(selectedPath)) &&
        !Object.values(nextChildren)
          .flat()
          .some((e) => normPath(e.path) === normPath(selectedPath))
      ) {
        setSelectedPath(driveList[0]?.path ?? null);
      }
    } catch (error) {
      setRootError(formatFsError(error, 'Unable to refresh'));
    } finally {
      setRootLoading(false);
    }
  }, [selectedPath]);

  const selectPath = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const targetDirForCreate = useCallback((): FsEntry | null => {
    if (!selectedPath) {
      return drivesRef.current.find(isCDrive) ?? drivesRef.current[0] ?? null;
    }
    const entry = findEntry(selectedPath);
    if (!entry) return null;
    if (isContainer(entry)) return entry;
    const parentPath = parentOf(entry.path);
    return (
      findEntry(parentPath) ?? {
        name: parentPath,
        path: parentPath,
        kind: 'dir' as const,
      }
    );
  }, [findEntry, selectedPath]);

  const startCreate = useCallback(
    (mode: 'create-file' | 'create-dir', parent?: FsEntry) => {
      const target = parent ?? targetDirForCreate();
      if (!target || !isContainer(target)) return;
      void expandPath(target.path);
      setDraft({
        mode,
        parentPath: target.path,
        draftName: mode === 'create-file' ? 'New File.txt' : 'New Folder',
      });
      setSelectedPath(target.path);
    },
    [expandPath, targetDirForCreate],
  );

  const startRename = useCallback((entry: FsEntry) => {
    if (entry.kind === 'drive') return;
    setDraft({
      mode: 'rename',
      parentPath: parentOf(entry.path),
      path: entry.path,
      draftName: entry.name,
    });
    setSelectedPath(entry.path);
  }, []);

  const setDraftName = useCallback((name: string) => {
    setDraft((prev) => (prev ? { ...prev, draftName: name } : prev));
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

  const commitDraft = useCallback(async () => {
    if (!draft) return;
    const name = draft.draftName.trim();
    if (!name) {
      setDraft(null);
      return;
    }
    try {
      let created: FsEntry;
      if (draft.mode === 'create-file') {
        created = await fsCreateFile(draft.parentPath, name);
      } else if (draft.mode === 'create-dir') {
        created = await fsCreateDir(draft.parentPath, name);
      } else if (draft.path) {
        created = await fsRename(draft.path, name);
      } else {
        setDraft(null);
        return;
      }
      await loadDir(draft.parentPath, { force: true });
      if (draft.mode === 'rename' && draft.path) {
        const oldKey = normPath(draft.path);
        setChildren((prev) => {
          const next = { ...prev };
          if (next[oldKey]) {
            delete next[oldKey];
          }
          return next;
        });
        setExpanded((prev) => {
          if (!prev.has(oldKey)) return prev;
          const next = new Set(prev);
          next.delete(oldKey);
          next.add(normPath(created.path));
          return next;
        });
      }
      setSelectedPath(created.path);
      setDraft(null);
    } catch (error) {
      window.alert(errorMessage(error, 'Operation failed'));
    }
  }, [draft, loadDir]);

  const deleteEntry = useCallback(
    async (entry: FsEntry): Promise<boolean> => {
      if (entry.kind === 'drive') return false;
      const label =
        entry.kind === 'dir'
          ? `Delete folder "${entry.name}" and its contents?`
          : `Delete "${entry.name}"?`;
      if (!window.confirm(label)) return false;
      try {
        await fsRemove(entry.path);
        const parentPath = parentOf(entry.path);
        await loadDir(parentPath, { force: true });
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(normPath(entry.path));
          return next;
        });
        if (selectedPath && normPath(selectedPath) === normPath(entry.path)) {
          setSelectedPath(parentPath);
        }
        return true;
      } catch (error) {
        window.alert(errorMessage(error, 'Delete failed'));
        return false;
      }
    },
    [loadDir, selectedPath],
  );

  const openEntry = useCallback(async (entry: FsEntry) => {
    if (entry.kind !== 'file') return;
    try {
      await fsOpenPath(entry.path);
    } catch (error) {
      window.alert(errorMessage(error, 'Unable to open file'));
    }
  }, []);

  const revealEntry = useCallback(async (entry: FsEntry) => {
    try {
      await fsRevealPath(entry.path);
    } catch (error) {
      window.alert(errorMessage(error, 'Unable to reveal path'));
    }
  }, []);

  const copyPath = useCallback(async (entry: FsEntry) => {
    try {
      await navigator.clipboard.writeText(entry.path);
    } catch (error) {
      console.warn('clipboard write failed', error);
    }
  }, []);

  const openAbout = useCallback(async (entry: FsEntry) => {
    setAboutLoading(true);
    setAboutError(null);
    setAboutInfo({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      extension: entry.extension,
      size: entry.size,
      modified: entry.modified,
    });
    try {
      const info = await fsEntryInfo(entry.path);
      setAboutInfo(info);
    } catch (error) {
      setAboutError(errorMessage(error, 'Unable to load details'));
    } finally {
      setAboutLoading(false);
    }
  }, []);

  const closeAbout = useCallback(() => {
    setAboutInfo(null);
    setAboutError(null);
    setAboutLoading(false);
  }, []);

  const visibleRows = useMemo(() => {
    return buildVisibleRows({
      entries: drives,
      children,
      expanded,
      loadingPaths,
      errors,
      query: searchQuery,
    });
  }, [children, drives, errors, expanded, loadingPaths, searchQuery]);

  return {
    username,
    drives,
    selectedPath,
    selectedEntry,
    searchOpen,
    searchQuery,
    draft,
    aboutInfo,
    aboutLoading,
    aboutError,
    rootError,
    rootLoading,
    visibleRows,
    setSearchOpen,
    setSearchQuery,
    selectPath,
    toggleExpand,
    expandPath,
    refresh,
    openEntry,
    revealEntry,
    copyPath,
    startCreate,
    startRename,
    setDraftName,
    cancelDraft,
    commitDraft,
    deleteEntry,
    openAbout,
    closeAbout,
    targetDirForCreate,
    findEntry,
  };
}

export type { ExplorerDraftMode };
