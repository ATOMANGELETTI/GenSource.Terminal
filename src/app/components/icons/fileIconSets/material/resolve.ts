import type { IconifyIcon } from '@iconify/types';
import {
  getMaterialFileIcon,
  getMaterialFolderIcon,
} from 'vscode-icon-resolver';

import {
  FILE_ICON_DATA,
  ICON_HEIGHT,
  ICON_WIDTH,
} from './icons-data';

export type MaterialIconName = keyof typeof FILE_ICON_DATA;

function normalizeMaterialName(
  raw: string,
  options: { isFolder?: boolean; expanded?: boolean } = {},
): MaterialIconName {
  const { isFolder = false, expanded = false } = options;

  if (raw === 'default_file') return fallbackFileName();
  if (raw === 'default_folder') {
    return expanded ? 'folder-base-open' : 'folder-base';
  }
  if (raw === 'default_root_folder') return 'folder-base-open';

  let slug = raw.replace(/_/g, '-');
  if (isFolder && expanded && !slug.endsWith('-open')) {
    slug = `${slug}-open`;
  }

  if (slug in FILE_ICON_DATA) {
    return slug as MaterialIconName;
  }

  return isFolder
    ? expanded
      ? 'folder-base-open'
      : 'folder-base'
    : fallbackFileName();
}

function fallbackFileName(): MaterialIconName {
  return 'document' in FILE_ICON_DATA ? 'document' : (Object.keys(FILE_ICON_DATA)[0] as MaterialIconName);
}

export function resolveMaterialFileIconName(fileName: string): MaterialIconName {
  return normalizeMaterialName(getMaterialFileIcon(fileName));
}

export function resolveMaterialFolderIconName(
  folderName: string,
  expanded: boolean,
): MaterialIconName {
  const raw = getMaterialFolderIcon(folderName, expanded);
  return normalizeMaterialName(raw, { isFolder: true, expanded });
}

export function resolveMaterialDriveIconName(): MaterialIconName {
  return 'database' in FILE_ICON_DATA ? 'database' : fallbackFileName();
}

function iconDimensions(
  data: (typeof FILE_ICON_DATA)[MaterialIconName],
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

export function toMaterialIconifyIcon(name: MaterialIconName): IconifyIcon {
  const data =
    FILE_ICON_DATA[name] ??
    FILE_ICON_DATA[fallbackFileName()];
  return {
    body: data.body,
    ...iconDimensions(data),
  };
}
