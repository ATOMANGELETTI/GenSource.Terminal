import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import ParticleField from "../../components/splash/ParticleField";
import {
  computeSplashProgress,
  isSplashReady,
  SPLASH_MIN_DURATION_MS,
  type SplashMilestone,
} from "../../lib/splash-progress";
import { isE2eMode } from "../../lib/e2e-window";
import {
  fetchAppInfo,
  initSettingsFromBackend,
  subscribeSettingsChanges,
} from "../../lib/settings";
import { showMainWindow } from "../../lib/window";

/** Pinned progress for Playwright screenshots (`?e2e=1`). */
const E2E_FROZEN_PROGRESS = 0.6;

/**
 * Dedicated `splash` Tauri window: Nord-themed boot screen with a particle
 * field and hybrid loading bar. Shows `main` (unless startMinimized), then
 * closes itself.
 */
export default function SplashWindow() {
  const e2e = isE2eMode();
  const [title, setTitle] = useState("GenSource Terminal");
  const [progress, setProgress] = useState(e2e ? E2E_FROZEN_PROGRESS : 0);
  const [exiting, setExiting] = useState(false);
  const [particlesActive, setParticlesActive] = useState(!e2e);

  const milestonesRef = useRef(new Set<SplashMilestone>());
  const startRef = useRef(performance.now());
  const handedOffRef = useRef(false);
  const startMinimizedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let frameId = 0;

    const mark = (milestone: SplashMilestone) => {
      milestonesRef.current.add(milestone);
    };

    void (async () => {
      // Skip Tauri IPC in Playwright — invoke can hang without a WebView.
      if (e2e) {
        mark("settings");
        mark("appinfo");
        return;
      }

      try {
        // Subscribe before fetch so a setup-time `settings-changed` emit is
        // not missed (packaged splash can race `.setup` otherwise).
        const stop = await subscribeSettingsChanges((next) => {
          startMinimizedRef.current = Boolean(next.startMinimized);
        });
        if (cancelled) {
          stop();
        } else {
          unlisten = stop;
        }
        const settings = await initSettingsFromBackend();
        if (!cancelled) {
          startMinimizedRef.current = Boolean(settings.startMinimized);
          mark("settings");
        }
      } catch (error) {
        console.warn("Splash: settings init failed", error);
        // Still advance so a failed invoke cannot trap the splash forever.
        if (!cancelled) {
          mark("settings");
        }
      }

      try {
        const info = await fetchAppInfo();
        if (!cancelled) {
          setTitle(info.productName || info.name || "GenSource Terminal");
          mark("appinfo");
        }
      } catch (error) {
        console.warn("Splash: app info failed", error);
        if (!cancelled) {
          mark("appinfo");
        }
      }
    })();

    // Visual e2e: keep a frozen frame (no handoff / close / particles).
    if (e2e) {
      setParticlesActive(false);
      setProgress(E2E_FROZEN_PROGRESS);
      return () => {
        cancelled = true;
        unlisten?.();
      };
    }

    const handoff = async () => {
      if (handedOffRef.current || cancelled) {
        return;
      }
      handedOffRef.current = true;
      setParticlesActive(false);
      setExiting(true);
      setProgress(1);

      try {
        if (!startMinimizedRef.current) {
          await showMainWindow();
        }
      } catch (error) {
        console.warn("Splash: failed to show main window", error);
      }

      // Brief fade so the bar reaching 100% is visible before close.
      await new Promise((resolve) => setTimeout(resolve, 320));
      if (cancelled) {
        return;
      }

      try {
        await getCurrentWindow().close();
      } catch (error) {
        console.warn("Splash: failed to close splash window", error);
      }
    };

    const tick = (now: number) => {
      if (cancelled || handedOffRef.current) {
        return;
      }

      const elapsedMs = now - startRef.current;
      const milestones = milestonesRef.current;
      const next = computeSplashProgress({
        elapsedMs,
        minDurationMs: SPLASH_MIN_DURATION_MS,
        milestones,
      });
      setProgress(next);

      if (
        isSplashReady({
          elapsedMs,
          minDurationMs: SPLASH_MIN_DURATION_MS,
          milestones,
        })
      ) {
        void handoff();
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      unlisten?.();
    };
  }, [e2e]);

  const onDrag = (event: MouseEvent<HTMLDivElement>) => {
    // Avoid starting a drag from the loading bar track itself.
    if ((event.target as HTMLElement).closest(".splash__bar")) {
      return;
    }
    void getCurrentWindow().startDragging();
  };

  const percent = Math.round(progress * 100);

  return (
    <div
      className={`splash${exiting ? " splash--exiting" : ""}`}
      onMouseDown={onDrag}
    >
      <ParticleField className="splash__particles" active={particlesActive} />

      <div className="splash__content">
        <h1 className="splash__title">{title}</h1>
        <p className="splash__status">Loading…</p>
      </div>

      <div
        className="splash__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Loading"
      >
        <div className="splash__bar-track">
          <div
            className="splash__bar-fill"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>
    </div>
  );
}
