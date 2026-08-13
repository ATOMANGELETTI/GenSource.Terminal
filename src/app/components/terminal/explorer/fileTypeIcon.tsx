import type { ReactElement } from 'react';

import type { FileIconSet } from '../../../types';
import type { FsEntry } from '../../../types';
import {
  kindLabel,
  renderFileTypeIcon,
  type FileIconOptions,
} from '../../icons/fileIconSets/renderFileTypeIcon';

export { kindLabel };

export function fileTypeIcon(
  entry: FsEntry,
  options: FileIconOptions,
): ReactElement {
  return renderFileTypeIcon(entry, options);
}

export type { FileIconSet, FileIconOptions };
