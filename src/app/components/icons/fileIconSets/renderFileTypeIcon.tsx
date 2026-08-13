import type { ReactElement } from 'react';
import { Icon } from '@iconify/react/offline';

import type { FileIconSet } from '../../../types';
import type { FsEntry, FsEntryKind } from '../../../types';
import {
  toCatppuccinIconifyIcon,
  resolveCatppuccinDriveIconName,
  resolveCatppuccinFileIconName,
  resolveCatppuccinFolderIconName,
} from './catppuccin/resolve';
import {
  toMaterialIconifyIcon,
  resolveMaterialDriveIconName,
  resolveMaterialFileIconName,
  resolveMaterialFolderIconName,
} from './material/resolve';
import { nordCategoryClass, resolveNordFileCategory } from './nord/categories';
import { NordDriveIcon, NordFileIcon, NordFolderIcon } from './nord/NordIcons';

export interface FileIconOptions {
  expanded?: boolean;
  iconSet: FileIconSet;
}

const ICON_SIZE = 18;

function kitIcon(
  icon: ReturnType<typeof toMaterialIconifyIcon>,
  className: string,
): ReactElement {
  return (
    <span className={className} aria-hidden="true">
      <Icon icon={icon} width={ICON_SIZE} height={ICON_SIZE} />
    </span>
  );
}

export function renderFileTypeIcon(
  entry: FsEntry,
  { expanded = false, iconSet }: FileIconOptions,
): ReactElement {
  if (entry.kind === 'drive') {
    if (iconSet === 'nord') {
      return (
        <span className="file-type-icon file-type-icon--drive file-type-icon--nord" aria-hidden="true">
          <NordDriveIcon />
        </span>
      );
    }

    const icon =
      iconSet === 'material'
        ? toMaterialIconifyIcon(resolveMaterialDriveIconName())
        : toCatppuccinIconifyIcon(resolveCatppuccinDriveIconName());

    return kitIcon(icon, 'file-type-icon file-type-icon--drive file-type-icon--kit');
  }

  if (entry.kind === 'dir') {
    if (iconSet === 'nord') {
      return (
        <span
          className={`file-type-icon file-type-icon--folder file-type-icon--nord${expanded ? ' file-type-icon--folder-open' : ''}`}
          aria-hidden="true"
        >
          <NordFolderIcon open={expanded} />
        </span>
      );
    }

    const icon =
      iconSet === 'material'
        ? toMaterialIconifyIcon(resolveMaterialFolderIconName(entry.name, expanded))
        : toCatppuccinIconifyIcon(resolveCatppuccinFolderIconName(entry.name, expanded));

    return kitIcon(
      icon,
      `file-type-icon file-type-icon--folder file-type-icon--kit${expanded ? ' file-type-icon--folder-open' : ''}`,
    );
  }

  if (iconSet === 'nord') {
    const category = resolveNordFileCategory(entry.name, entry.extension);
    return (
      <span
        className={`file-type-icon file-type-icon--file file-type-icon--nord ${nordCategoryClass(category)}`}
        aria-hidden="true"
      >
        <NordFileIcon />
      </span>
    );
  }

  const icon =
    iconSet === 'material'
      ? toMaterialIconifyIcon(resolveMaterialFileIconName(entry.name))
      : toCatppuccinIconifyIcon(resolveCatppuccinFileIconName(entry.name));

  return kitIcon(icon, 'file-type-icon file-type-icon--file file-type-icon--kit');
}

export function kindLabel(kind: FsEntryKind): string {
  switch (kind) {
    case 'drive':
      return 'Drive';
    case 'dir':
      return 'Folder';
    case 'file':
      return 'File';
  }
}
