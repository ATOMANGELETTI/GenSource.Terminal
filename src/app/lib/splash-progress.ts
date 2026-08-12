/** Hybrid splash progress: milestone floor + timed ease over a minimum duration. */

export const SPLASH_MIN_DURATION_MS = 4500;

export type SplashMilestone = "settings" | "appinfo";

const MILESTONE_WEIGHT: Record<SplashMilestone, number> = {
  settings: 0.4,
  appinfo: 0.3,
};

/** Smoothstep ease for the time-based portion of the bar. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function milestoneFloor(done: ReadonlySet<SplashMilestone>): number {
  let floor = 0;
  for (const key of done) {
    floor += MILESTONE_WEIGHT[key] ?? 0;
  }
  return Math.min(1, floor);
}

/**
 * Combined progress in [0, 1]. The bar never goes backwards: time eases toward
 * 1 over `minDurationMs`, and completed milestones raise the floor.
 */
export function computeSplashProgress(options: {
  elapsedMs: number;
  minDurationMs?: number;
  milestones: ReadonlySet<SplashMilestone>;
}): number {
  const minDurationMs = options.minDurationMs ?? SPLASH_MIN_DURATION_MS;
  const timed = easeInOut(options.elapsedMs / minDurationMs);
  const floor = milestoneFloor(options.milestones);
  return Math.min(1, Math.max(timed, floor));
}

export function isSplashReady(options: {
  elapsedMs: number;
  minDurationMs?: number;
  milestones: ReadonlySet<SplashMilestone>;
  required?: readonly SplashMilestone[];
}): boolean {
  const minDurationMs = options.minDurationMs ?? SPLASH_MIN_DURATION_MS;
  const required = options.required ?? (["settings", "appinfo"] as const);
  const allDone = required.every((m) => options.milestones.has(m));
  return allDone && options.elapsedMs >= minDurationMs;
}
