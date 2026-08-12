import { useEffect, useState } from "react";

import { fetchSystemMetrics } from "../lib/terminal/system-metrics";
import type { SystemMetrics } from "../types";

const POLL_MS = 1000;

/**
 * Polls native system metrics every 1s while the document is visible.
 * Pauses when `document.visibilityState === "hidden"`.
 */
export function useSystemMetrics(): SystemMetrics | null {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      void fetchSystemMetrics()
        .then((sample) => {
          if (!cancelled) {
            setMetrics(sample);
          }
        })
        .catch(() => {
          /* keep last good sample */
        });
    };

    const start = () => {
      if (timer != null || document.visibilityState === "hidden") {
        return;
      }
      tick();
      timer = setInterval(tick, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        clear();
      } else {
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return metrics;
}
