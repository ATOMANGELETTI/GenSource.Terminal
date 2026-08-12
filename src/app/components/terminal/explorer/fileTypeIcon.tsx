import type { ReactElement } from 'react';
import { Icon } from '@iconify/react/offline';

import { DriveIcon, FolderIcon } from '../../icons/MenuIcons';
import { resolveVscodeFileIcon } from '../../icons/vscodeFileIcons';
import type { FsEntry, FsEntryKind } from '../../../types';

function normalizeExt(entry: FsEntry): string {
  if (entry.extension) {
    return entry.extension.replace(/^\./, '').toLowerCase();
  }
  if (entry.name.includes('.')) {
    return (entry.name.split('.').pop() ?? '').toLowerCase();
  }
  return '';
}

export function fileTypeIcon(entry: FsEntry): ReactElement {
  if (entry.kind === 'drive') {
    return (
      <span className="file-type-icon file-type-icon--drive" aria-hidden="true">
        <DriveIcon />
      </span>
    );
  }

  if (entry.kind === 'dir') {
    return (
      <span className="file-type-icon file-type-icon--folder" aria-hidden="true">
        <FolderIcon />
      </span>
    );
  }

  const icon = resolveVscodeFileIcon(entry.name, normalizeExt(entry));
  return (
    <span className="file-type-icon file-type-icon--kit" aria-hidden="true">
      <Icon icon={icon} width={16} height={16} />
    </span>
  );
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
