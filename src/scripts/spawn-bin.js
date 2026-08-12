/**
 * Spawn local npm package bins without `shell: true` (avoids Node DEP0190).
 * Resolves the package's JS entry and runs it with `process.execPath`.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export function resolvePackageBin(packageName, binName = packageName) {
  const pkgJsonPath = require.resolve(`${packageName}/package.json`);
  const pkg = require(pkgJsonPath);
  const binField = pkg.bin;
  const relative =
    typeof binField === "string"
      ? binField
      : binField?.[binName] ?? binField?.[packageName];
  if (!relative) {
    throw new Error(`No bin "${binName}" found in ${packageName}`);
  }
  return join(dirname(pkgJsonPath), relative);
}

export function spawnPackageBin(
  packageName,
  args = [],
  options = {},
  binName = packageName,
) {
  const entry = resolvePackageBin(packageName, binName);
  const { shell: _ignored, ...rest } = options;
  return spawn(process.execPath, [entry, ...args], {
    ...rest,
    shell: false,
    env: rest.env ?? process.env,
  });
}

export function spawnSyncCommand(command, args = [], options = {}) {
  const { shell: _ignored, ...rest } = options;
  return spawnSync(command, args, {
    ...rest,
    shell: false,
    env: rest.env ?? process.env,
  });
}
