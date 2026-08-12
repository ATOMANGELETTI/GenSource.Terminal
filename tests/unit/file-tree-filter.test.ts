import { describe, expect, it } from 'vitest';

import { buildVisibleRows } from '@/components/terminal/explorer/useFileTree';
import type { FsEntry } from '@/types';

const drive: FsEntry = { name: 'C:', path: 'C:\\', kind: 'drive' };
const src: FsEntry = { name: 'src', path: 'C:\\src', kind: 'dir' };
const docs: FsEntry = { name: 'docs', path: 'C:\\docs', kind: 'dir' };
const readme: FsEntry = {
  name: 'README.md',
  path: 'C:\\src\\README.md',
  kind: 'file',
};
const sourceFile: FsEntry = {
  name: 'main.ts',
  path: 'C:\\src\\main.ts',
  kind: 'file',
};
const guide: FsEntry = {
  name: 'guide.md',
  path: 'C:\\docs\\guide.md',
  kind: 'file',
};

const children: Record<string, FsEntry[]> = {
  'c:': [src, docs],
  'c:\\src': [readme, sourceFile],
  'c:\\docs': [guide],
};

function rows(query: string, expanded: string[] = []) {
  return buildVisibleRows({
    entries: [drive],
    children,
    expanded: new Set(expanded),
    loadingPaths: new Set(),
    errors: {},
    query,
  });
}

describe('file-tree filtering', () => {
  it('reveals a nested match through non-matching collapsed ancestors', () => {
    expect(
      rows('readme').map(({ entry, depth, expanded }) => ({
        name: entry.name,
        depth,
        expanded,
      })),
    ).toEqual([
      { name: 'C:', depth: 0, expanded: true },
      { name: 'src', depth: 1, expanded: true },
      { name: 'README.md', depth: 2, expanded: false },
    ]);
  });

  it('omits sibling branches without matches', () => {
    expect(rows('readme').map((row) => row.entry.name)).toEqual(['C:', 'src', 'README.md']);
  });

  it('keeps the normal expansion walk for an empty query', () => {
    expect(rows('', ['c:', 'c:\\src']).map((row) => row.entry.name)).toEqual([
      'C:',
      'src',
      'README.md',
      'main.ts',
      'docs',
    ]);
  });

  it('matches basename substrings case-insensitively', () => {
    expect(rows('AdMe').map((row) => row.entry.name)).toEqual(['C:', 'src', 'README.md']);
  });
});
