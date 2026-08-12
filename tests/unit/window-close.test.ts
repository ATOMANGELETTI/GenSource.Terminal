import { beforeEach, describe, expect, it, vi } from "vitest";

const hide = vi.fn(async () => undefined);
const close = vi.fn(async () => undefined);

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => mockWindow,
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  WebviewWindow: {
    getByLabel: vi.fn(async () => null),
  },
}));

let mockWindow: { label: string; hide: typeof hide; close: typeof close };

describe("closeWindow", () => {
  beforeEach(() => {
    vi.resetModules();
    hide.mockClear();
    close.mockClear();
    mockWindow = { label: "main", hide, close };
  });

  it("hides the main window so the tray can restore it", async () => {
    const { closeWindow } = await import("@/lib/window");
    await closeWindow();
    expect(hide).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it("closes non-main windows", async () => {
    mockWindow = { label: "splash", hide, close };
    const { closeWindow } = await import("@/lib/window");
    await closeWindow();
    expect(close).toHaveBeenCalledOnce();
    expect(hide).not.toHaveBeenCalled();
  });
});
