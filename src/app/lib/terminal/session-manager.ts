export type TabStatus = "running" | "exited" | "error";

export interface TabState {
  tabId: string;
  sessionId: string | null;
  profileId: string;
  title: string;
  pinned: boolean;
  status: TabStatus;
  exitCode?: number | null;
  errorMessage?: string;
  /** History text written once into xterm on restore (not replayed as stdin). */
  initialScrollback?: string;
}

export function createTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ensureActiveTab(
  tabs: TabState[],
  activeTabId: string | null,
): string | null {
  if (tabs.some((t) => t.tabId === activeTabId)) return activeTabId;
  return tabs[0]?.tabId ?? null;
}

export function createTabState(options: {
  profileId: string;
  title: string;
  pinned?: boolean;
  tabId?: string;
  initialScrollback?: string;
}): TabState {
  return {
    tabId: options.tabId ?? createTabId(),
    sessionId: null,
    profileId: options.profileId,
    title: options.title,
    pinned: options.pinned ?? false,
    status: "running",
    initialScrollback: options.initialScrollback,
  };
}
