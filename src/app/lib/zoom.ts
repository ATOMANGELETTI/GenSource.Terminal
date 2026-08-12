import { getCurrentWebview } from "@tauri-apps/api/webview";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1.0;

let currentZoom = ZOOM_DEFAULT;

function clamp(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

async function setZoom(factor: number): Promise<void> {
  currentZoom = clamp(factor);
  await getCurrentWebview().setZoom(currentZoom);
}

export async function zoomIn(): Promise<void> {
  await setZoom(currentZoom + ZOOM_STEP);
}

export async function zoomOut(): Promise<void> {
  await setZoom(currentZoom - ZOOM_STEP);
}

export async function zoomReset(): Promise<void> {
  await setZoom(ZOOM_DEFAULT);
}
