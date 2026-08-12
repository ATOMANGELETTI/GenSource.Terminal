import { invoke } from "@tauri-apps/api/core";

import type { SystemMetrics } from "../../types";

/** Thin wrapper around the `get_system_metrics` Tauri command. */
export function fetchSystemMetrics(): Promise<SystemMetrics> {
  return invoke<SystemMetrics>("get_system_metrics");
}
