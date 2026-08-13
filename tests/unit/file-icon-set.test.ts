import { describe, expect, it } from 'vitest';

import { resolveFileIconSet } from '@/lib/file-icons';
import {
  resolveCatppuccinFileIconName,
  resolveCatppuccinFolderIconName,
} from '@/components/icons/fileIconSets/catppuccin/resolve';
import {
  resolveMaterialFileIconName,
  resolveMaterialFolderIconName,
} from '@/components/icons/fileIconSets/material/resolve';
import { resolveNordFileCategory } from '@/components/icons/fileIconSets/nord/categories';

describe('resolveFileIconSet', () => {
  it('normalizes known values and aliases', () => {
    expect(resolveFileIconSet('material')).toBe('material');
    expect(resolveFileIconSet('mat')).toBe('material');
    expect(resolveFileIconSet('catppuccin')).toBe('catppuccin');
    expect(resolveFileIconSet('cat')).toBe('catppuccin');
    expect(resolveFileIconSet('nord')).toBe('nord');
    expect(resolveFileIconSet('nord-native')).toBe('nord');
  });

  it('falls back to catppuccin for invalid values', () => {
    expect(resolveFileIconSet('vscode')).toBe('catppuccin');
    expect(resolveFileIconSet('')).toBe('catppuccin');
    expect(resolveFileIconSet(undefined)).toBe('catppuccin');
  });
});

describe('material icon resolver', () => {
  it('resolves common file and folder names', () => {
    expect(resolveMaterialFileIconName('index.ts')).toBe('typescript');
    expect(resolveMaterialFileIconName('package.json')).toBe('nodejs');
    expect(resolveMaterialFolderIconName('src', false)).toBe('folder-src');
    expect(resolveMaterialFolderIconName('src', true)).toBe('folder-src-open');
  });
});

describe('catppuccin icon resolver', () => {
  it('resolves common file and folder names', () => {
    expect(resolveCatppuccinFileIconName('index.ts')).toBe('typescript');
    expect(resolveCatppuccinFileIconName('package.json')).toBe('package-json');
    expect(resolveCatppuccinFolderIconName('src', false)).toBe('folder-src');
    expect(resolveCatppuccinFolderIconName('src', true)).toBe('folder-src-open');
  });
});

describe('nord file categories', () => {
  it('maps extensions to nord categories', () => {
    expect(resolveNordFileCategory('index.ts')).toBe('code');
    expect(resolveNordFileCategory('config.json')).toBe('config');
    expect(resolveNordFileCategory('readme.md')).toBe('markup');
    expect(resolveNordFileCategory('styles.css')).toBe('style');
    expect(resolveNordFileCategory('run.ps1')).toBe('shell');
    expect(resolveNordFileCategory('photo.png')).toBe('media');
    expect(resolveNordFileCategory('notes.txt')).toBe('default');
  });
});
