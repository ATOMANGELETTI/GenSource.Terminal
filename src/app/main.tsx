import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/plus-jakarta-sans";

import App from "./App";
import { resolveWindowLabel } from "./lib/e2e-window";
// Keep @tauri-apps/plugin-store in the app entry graph (via app-store helper).
import "./lib/app-store";
import ContextMenuWindow from "./pages/context-menu/ContextMenuWindow";
import SplashWindow from "./pages/splash/SplashWindow";
import TrayMenuWindow from "./pages/tray-menu/TrayMenuWindow";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

// Secondary windows (splash, tray-menu, context-menu) share this bundle;
// pick the tree by Tauri window label (see tauri.conf.json), or `?window=`
// for Vite e2e.
const windowLabel = resolveWindowLabel();
const rootTree =
  windowLabel === "splash" ? (
    <SplashWindow />
  ) : windowLabel === "tray-menu" ? (
    <TrayMenuWindow />
  ) : windowLabel === "context-menu" ? (
    <ContextMenuWindow />
  ) : (
    <App />
  );

createRoot(rootElement).render(<StrictMode>{rootTree}</StrictMode>);
