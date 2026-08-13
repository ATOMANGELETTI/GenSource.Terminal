import type { IconifyIcon } from '@iconify/types';
import {
  getCatppuccinFileIcon,
  getCatppuccinFolderIcon,
} from 'vscode-icon-resolver';

import {
  FILE_ICON_DATA,
  ICON_HEIGHT,
  ICON_WIDTH,
} from './icons-data';

export type CatppuccinIconName = keyof typeof FILE_ICON_DATA;

function normalizeCatppuccinName(
  raw: string,
  options: { isFolder?: boolean; expanded?: boolean } = {},
): CatppuccinIconName {
  const { isFolder = false, expanded = false } = options;

  if (raw === '_file') return fallbackFileName();
  if (raw === '_folder') {
    return expanded ? 'folder-open' : 'folder';
  }

  let slug = raw.replace(/_/g, '-');
  if (isFolder && !slug.startsWith('folder-')) {
    slug = `folder-${slug}`;
  }
  if (isFolder && expanded && !slug.endsWith('-open')) {
    slug = `${slug}-open`;
  }

  if (slug in FILE_ICON_DATA) {
    return slug as CatppuccinIconName;
  }

  return isFolder
    ? expanded
      ? 'folder-open'
      : 'folder'
    : fallbackFileName();
}

function fallbackFileName(): CatppuccinIconName {
  return 'file' in FILE_ICON_DATA ? 'file' : (Object.keys(FILE_ICON_DATA)[0] as CatppuccinIconName);
}

export function resolveCatppuccinFileIconName(fileName: string): CatppuccinIconName {
  return normalizeCatppuccinName(getCatppuccinFileIcon(fileName));
}

export function resolveCatppuccinFolderIconName(
  folderName: string,
  expanded: boolean,
): CatppuccinIconName {
  const raw = getCatppuccinFolderIcon(folderName);
  return normalizeCatppuccinName(raw, { isFolder: true, expanded });
}

export function resolveCatppuccinDriveIconName(): CatppuccinIconName {
  return 'folder';
}

function iconDimensions(
  data: (typeof FILE_ICON_DATA)[CatppuccinIconName],
): Pick<IconifyIcon, 'width' | 'height'> {
  const width =
    typeof data === 'object' && data != null && 'width' in data && typeof data.width === 'number'
      ? data.width
      : ICON_WIDTH;
  const height =
    typeof data === 'object' && data != null && 'height' in data && typeof data.height === 'number'
      ? data.height
      : ICON_HEIGHT;
  return { width, height };
}

export function toCatppuccinIconifyIcon(name: CatppuccinIconName): IconifyIcon {
  const data =
    FILE_ICON_DATA[name] ??
    FILE_ICON_DATA[fallbackFileName()];
  return {
    body: data.body,
    ...iconDimensions(data),
  };
}
