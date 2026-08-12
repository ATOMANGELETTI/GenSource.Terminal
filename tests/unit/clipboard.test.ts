import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(async () => undefined),
  readText: vi.fn(async () => 'mocked'),
}));

describe('clipboard helper', () => {
  it('copies the current selection via the clipboard plugin', async () => {
    const { copySelection } = await import('@/lib/clipboard');
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');

    const range = document.createRange();
    const text = document.createTextNode('hello');
    document.body.appendChild(text);
    range.selectNodeContents(text);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    await copySelection();
    expect(writeText).toHaveBeenCalledWith('hello');

    selection?.removeAllRanges();
    text.remove();
  });

  it('pastes clipboard text into a focused input', async () => {
    const { pasteAtFocus } = await import('@/lib/clipboard');
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.value = '';
    input.selectionStart = 0;
    input.selectionEnd = 0;

    await pasteAtFocus();
    expect(readText).toHaveBeenCalled();
    expect(input.value).toBe('mocked');

    input.remove();
  });
});
