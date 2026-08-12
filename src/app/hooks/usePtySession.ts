import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

import { isE2eMode } from "../lib/e2e-window";
import type {
  PtyCreateResult,
  PtyExitEvent,
  PtyOutputEvent,
} from "../types";

export interface UsePtySessionOptions {
  enabled: boolean;
  profileId: string;
  cols: number;
  rows: number;
  onOutput: (sessionId: string, data: string) => void;
  onExit: (sessionId: string, code: number | null) => void;
  onError: (message: string) => void;
}

export interface UsePtySessionResult {
  sessionId: string | null;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => Promise<void>;
  recreate: () => Promise<void>;
}

const E2E_SESSION_PREFIX = "e2e-session-";

function makeE2eSessionId(): string {
  return `${E2E_SESSION_PREFIX}${crypto.randomUUID?.() ?? String(Date.now())}`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/**
 * Per-tab PTY invoke + event wiring. In e2e / browser-only mode, skips
 * invoke and simulates an idle session so the UI still mounts.
 *
 * Listeners are registered before `pty_create` so the initial prompt is not
 * lost; early chunks are buffered by sessionId until create resolves.
 */
export function usePtySession(
  options: UsePtySessionOptions,
): UsePtySessionResult {
  const {
    enabled,
    profileId,
    cols,
    rows,
    onOutput,
    onExit,
    onError,
  } = options;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOutputRef = useRef(onOutput);
  const onExitRef = useRef(onExit);
  const onErrorRef = useRef(onError);
  const colsRef = useRef(cols);
  const rowsRef = useRef(rows);
  const createGenRef = useRef(0);
  /** Early `pty-output` chunks keyed by sessionId (listen-before-create). */
  const earlyOutputRef = useRef<Map<string, string[]>>(new Map());
  /** Early `pty-exit` payloads keyed by sessionId. */
  const earlyExitRef = useRef<Map<string, number | null>>(new Map());

  useEffect(() => {
    onOutputRef.current = onOutput;
  }, [onOutput]);
  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const clearResizeTimer = () => {
    if (resizeTimerRef.current !== null) {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = null;
    }
  };

  const flushEarlyOutput = (id: string) => {
    const chunks = earlyOutputRef.current.get(id);
    if (chunks) {
      earlyOutputRef.current.delete(id);
      for (const data of chunks) {
        onOutputRef.current(id, data);
      }
    }
    if (earlyExitRef.current.has(id)) {
      const code = earlyExitRef.current.get(id) ?? null;
      earlyExitRef.current.delete(id);
      onExitRef.current(id, code);
    }
  };

  const killSession = useCallback(async (id: string | null) => {
    if (!id) return;
    if (isE2eMode() || id.startsWith(E2E_SESSION_PREFIX)) {
      return;
    }
    try {
      await invoke("pty_kill", { args: { sessionId: id } });
    } catch (error) {
      console.warn("pty_kill failed", error);
    }
  }, []);

  const createSession = useCallback(async () => {
    const gen = ++createGenRef.current;
    earlyOutputRef.current.clear();
    earlyExitRef.current.clear();

    if (isE2eMode()) {
      const id = makeE2eSessionId();
      if (gen !== createGenRef.current) return;
      sessionIdRef.current = id;
      setSessionId(id);
      return;
    }

    try {
      const result = await invoke<PtyCreateResult>("pty_create", {
        args: {
          profileId,
          cols: Math.max(1, colsRef.current),
          rows: Math.max(1, rowsRef.current),
        },
      });
      if (gen !== createGenRef.current) {
        void killSession(result.sessionId);
        return;
      }
      // Set ref before flush so live events after this point deliver directly.
      sessionIdRef.current = result.sessionId;
      flushEarlyOutput(result.sessionId);
      setSessionId(result.sessionId);
    } catch (error) {
      if (gen !== createGenRef.current) return;
      sessionIdRef.current = null;
      setSessionId(null);
      onErrorRef.current(errorMessage(error, "pty_create failed"));
    }
  }, [killSession, profileId]);

  // Subscribe before create so the reader thread's first prompt is not dropped.
  useEffect(() => {
    if (!enabled) {
      const previous = sessionIdRef.current;
      if (previous !== null) {
        sessionIdRef.current = null;
        // Defer so we do not synchronously cascade setState in this effect.
        queueMicrotask(() => {
          setSessionId(null);
        });
        void killSession(previous);
      }
      return;
    }

    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    void (async () => {
      if (!isE2eMode()) {
        try {
          const stopOutput = await listen<PtyOutputEvent>(
            "pty-output",
            (event) => {
              const { sessionId: sid, data } = event.payload;
              if (sid === sessionIdRef.current) {
                onOutputRef.current(sid, data);
                return;
              }
              // Session not known yet (or stale id): buffer by sessionId.
              const list = earlyOutputRef.current.get(sid) ?? [];
              list.push(data);
              earlyOutputRef.current.set(sid, list);
            },
          );
          const stopExit = await listen<PtyExitEvent>("pty-exit", (event) => {
            const { sessionId: sid, code } = event.payload;
            if (sid === sessionIdRef.current) {
              onExitRef.current(sid, code);
              return;
            }
            earlyExitRef.current.set(sid, code);
          });
          if (cancelled) {
            stopOutput();
            stopExit();
            return;
          }
          unlisteners.push(stopOutput, stopExit);
        } catch (error) {
          console.warn("Failed to subscribe to pty events", error);
          if (cancelled) return;
          onErrorRef.current(
            errorMessage(error, "Failed to subscribe to pty events"),
          );
          return;
        }
      }

      if (cancelled) return;
      await createSession();
    })();

    return () => {
      cancelled = true;
      createGenRef.current += 1;
      clearResizeTimer();
      earlyOutputRef.current.clear();
      earlyExitRef.current.clear();
      for (const stop of unlisteners) {
        stop();
      }
      const previous = sessionIdRef.current;
      sessionIdRef.current = null;
      void killSession(previous);
    };
  }, [enabled, profileId, createSession, killSession]);

  const write = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id || isE2eMode() || id.startsWith(E2E_SESSION_PREFIX)) {
      return;
    }
    void invoke("pty_write", { args: { sessionId: id, data } }).catch(
      (error) => {
        console.warn("pty_write failed", error);
      },
    );
  }, []);

  const resize = useCallback((nextCols: number, nextRows: number) => {
    colsRef.current = nextCols;
    rowsRef.current = nextRows;
    clearResizeTimer();
    resizeTimerRef.current = setTimeout(() => {
      resizeTimerRef.current = null;
      const id = sessionIdRef.current;
      if (!id || isE2eMode() || id.startsWith(E2E_SESSION_PREFIX)) {
        return;
      }
      void invoke("pty_resize", {
        args: {
          sessionId: id,
          cols: Math.max(1, nextCols),
          rows: Math.max(1, nextRows),
        },
      }).catch((error) => {
        console.warn("pty_resize failed", error);
      });
    }, 50);
  }, []);

  const kill = useCallback(async () => {
    clearResizeTimer();
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setSessionId(null);
    await killSession(id);
  }, [killSession]);

  const recreate = useCallback(async () => {
    await kill();
    await createSession();
  }, [createSession, kill]);

  return { sessionId, write, resize, kill, recreate };
}
