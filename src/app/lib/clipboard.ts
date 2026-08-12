import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";

/** Copies the current text selection (if any) to the OS clipboard. */
export async function copySelection(): Promise<void> {
  const selection = window.getSelection()?.toString();
  if (!selection) {
    return;
  }
  await writeText(selection);
}

/**
 * Pastes clipboard text into the focused editable element, if any.
 * No-op when nothing editable is focused or the clipboard is empty.
 */
export async function pasteAtFocus(): Promise<void> {
  const active = document.activeElement;
  const isTextInput =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  const isContentEditable =
    active instanceof HTMLElement && active.isContentEditable;

  if (!isTextInput && !isContentEditable) {
    return;
  }

  const text = await readText();
  if (!text) {
    return;
  }

  if (isTextInput) {
    const input = active;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("insertText", false, text);
  }
}
