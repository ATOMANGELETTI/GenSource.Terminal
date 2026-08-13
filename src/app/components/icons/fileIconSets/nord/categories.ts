export type NordFileCategory =
  | 'code'
  | 'config'
  | 'markup'
  | 'style'
  | 'shell'
  | 'media'
  | 'default';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'rs', 'py', 'pyw',
  'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'cs',
  'fs', 'fsx', 'vb', 'swift', 'rb', 'php', 'lua', 'pl', 'r', 'scala', 'clj',
  'ex', 'exs', 'erl', 'hs', 'zig', 'nim', 'vue', 'svelte', 'dart', 'sql',
  'graphql', 'gql', 'wasm', 'sol', 'toml',
]);

const CONFIG_EXTENSIONS = new Set([
  'json', 'json5', 'jsonc', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'env',
  'lock', 'prisma',
]);

const MARKUP_EXTENSIONS = new Set([
  'html', 'htm', 'xhtml', 'md', 'mdx', 'xml', 'svg', 'tex', 'adoc', 'rst',
]);

const STYLE_EXTENSIONS = new Set(['css', 'scss', 'sass', 'less', 'styl']);

const SHELL_EXTENSIONS = new Set(['ps1', 'psm1', 'psd1', 'sh', 'bash', 'zsh', 'bat', 'cmd']);

const MEDIA_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tif', 'tiff', 'avif',
  'mp3', 'wav', 'flac', 'ogg', 'mp4', 'mkv', 'mov', 'avi', 'webm', 'zip',
  '7z', 'rar', 'tar', 'gz', 'bz2', 'xz', 'pdf', 'woff', 'woff2', 'ttf', 'otf',
]);

const CONFIG_BASENAMES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock',
  'bun.lockb', 'tsconfig.json', 'jsconfig.json', 'cargo.toml', 'cargo.lock',
  'go.mod', 'go.sum', 'composer.json', 'composer.lock', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'pyproject.toml', 'requirements.txt',
  'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml',
  '.editorconfig', '.gitignore', '.gitattributes', '.npmrc', 'deno.json',
  'deno.jsonc',
]);

function normalizeExt(fileName: string, extension?: string): string {
  if (extension) {
    return extension.replace(/^\./, '').toLowerCase();
  }
  if (fileName.includes('.')) {
    return (fileName.split('.').pop() ?? '').toLowerCase();
  }
  return '';
}

export function resolveNordFileCategory(
  fileName: string,
  extension?: string,
): NordFileCategory {
  const base = fileName.toLowerCase();
  const ext = normalizeExt(fileName, extension);

  if (CONFIG_BASENAMES.has(base) || base.startsWith('.env')) {
    return 'config';
  }
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
    return 'config';
  }
  if (base === 'makefile' || base === 'cmakelists.txt') {
    return 'code';
  }

  if (CODE_EXTENSIONS.has(ext)) return 'code';
  if (CONFIG_EXTENSIONS.has(ext)) return 'config';
  if (MARKUP_EXTENSIONS.has(ext)) return 'markup';
  if (STYLE_EXTENSIONS.has(ext)) return 'style';
  if (SHELL_EXTENSIONS.has(ext)) return 'shell';
  if (MEDIA_EXTENSIONS.has(ext)) return 'media';

  return 'default';
}

export function nordCategoryClass(category: NordFileCategory): string {
  return `file-type-icon--nord-${category}`;
}
