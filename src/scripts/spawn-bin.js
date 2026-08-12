/**
 * Spawn local npm package bins without `shell: true` (avoids Node DEP0190).
 * Resolves the package's JS entry from the repo root and runs it with
 * `process.execPath`.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireFromRoot = createRequire(join(repoRoot, "package.json"));

export function resolvePackageBin(packageName, binName = packageName) {
  let pkgJsonPath;
  try {
    pkgJsonPath = requireFromRoot.resolve(`${packageName}/package.json`);
  } catch (err) {
    if (err && typeof err === "object" && err.code === "MODULE_NOT_FOUND") {
      throw new Error(
        `Cannot find package "${packageName}". From the project root run: npm install`,
        { cause: err },
      );
    }
    throw err;
  }
  const pkg = requireFromRoot(pkgJsonPath);
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
