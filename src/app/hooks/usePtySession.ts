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

/**
 * Per-tab PTY invoke + event wiring. In e2e / browser-only mode, skips
 * invoke and simulates an idle session so the UI still mounts.
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

  const killSession = useCallback(async (id: string | null) => {
    if (!id) return;
    if (isE2eMode() || id.startsWith(E2E_SESSION_PREFIX)) {
      return;
    }
    try {
      await invoke("pty_kill", { sessionId: id });
    } catch (error) {
      console.warn("pty_kill failed", error);
    }
  }, []);

  const createSession = useCallback(async () => {
    const gen = ++createGenRef.current;

    if (isE2eMode()) {
      const id = makeE2eSessionId();
      if (gen !== createGenRef.current) return;
      sessionIdRef.current = id;
      setSessionId(id);
      return;
    }

    try {
      const result = await invoke<PtyCreateResult>("pty_create", {
        profileId,
        cols: Math.max(1, colsRef.current),
        rows: Math.max(1, rowsRef.current),
      });
      if (gen !== createGenRef.current) {
        void killSession(result.sessionId);
        return;
      }
      sessionIdRef.current = result.sessionId;
      setSessionId(result.sessionId);
    } catch (error) {
      if (gen !== createGenRef.current) return;
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "pty_create failed";
      // Real Rust spawn/profile failures surface in the pane banner.
      if (/failed to spawn|profile not found/i.test(message)) {
        sessionIdRef.current = null;
        setSessionId(null);
        onErrorRef.current(message);
        return;
      }
      // Browser-only / Track A not yet registered: keep UI complete with a
      // local stub session so tabs and xterm still mount.
      const stubId = makeE2eSessionId();
      sessionIdRef.current = stubId;
      setSessionId(stubId);
    }
  }, [killSession, profileId]);

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

    void createSession();

    return () => {
      createGenRef.current += 1;
      clearResizeTimer();
      const previous = sessionIdRef.current;
      sessionIdRef.current = null;
      void killSession(previous);
    };
  }, [enabled, profileId, createSession, killSession]);

  useEffect(() => {
    if (!sessionId || isE2eMode() || sessionId.startsWith(E2E_SESSION_PREFIX)) {
      return;
    }

    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    void (async () => {
      try {
        const stopOutput = await listen<PtyOutputEvent>("pty-output", (event) => {
          if (event.payload.sessionId !== sessionIdRef.current) return;
          onOutputRef.current(event.payload.sessionId, event.payload.data);
        });
        const stopExit = await listen<PtyExitEvent>("pty-exit", (event) => {
          if (event.payload.sessionId !== sessionIdRef.current) return;
          onExitRef.current(event.payload.sessionId, event.payload.code);
        });
        if (cancelled) {
          stopOutput();
          stopExit();
        } else {
          unlisteners.push(stopOutput, stopExit);
        }
      } catch (error) {
        console.warn("Failed to subscribe to pty events", error);
      }
    })();

    return () => {
      cancelled = true;
      for (const stop of unlisteners) {
        stop();
      }
    };
  }, [sessionId]);

  const write = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id || isE2eMode() || id.startsWith(E2E_SESSION_PREFIX)) {
      return;
    }
    void invoke("pty_write", { sessionId: id, data }).catch((error) => {
      console.warn("pty_write failed", error);
    });
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
        sessionId: id,
        cols: Math.max(1, nextCols),
        rows: Math.max(1, nextRows),
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
