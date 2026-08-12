export interface AppInfo {
  name: string;
  version: string;
  description?: string;
  productName?: string;
  identifier?: string;
  publisher?: string;
}

export interface AppSettings {
  theme: string;
  fontFamily: string;
  fontSize: number;
  startMinimized: boolean;
  autostart: boolean;
  alwaysOnTop: boolean;
}

export type KeybindingScope = "global" | "local";

export interface Keybinding {
  id: string;
  shortcut: string;
  enabled: boolean;
  scope: KeybindingScope;
}

/** Matches `commands::greet` which returns a bare `String`. */
export type GreetResponse = string;

export interface GreetArgs {
  name: string;
}
