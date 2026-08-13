import type { FileIconSet } from '../types';

const FILE_ICON_SET_ALIASES: Record<string, FileIconSet> = {
  material: 'material',
  mat: 'material',
  catppuccin: 'catppuccin',
  cat: 'catppuccin',
  nord: 'nord',
  'nord-native': 'nord',
};

/** Normalize `settings.json` `fileIconSet` (invalid → catppuccin). */
export function resolveFileIconSet(raw: string | undefined | null): FileIconSet {
  const key = (raw ?? '').trim().toLowerCase();
  return FILE_ICON_SET_ALIASES[key] ?? 'catppuccin';
}
