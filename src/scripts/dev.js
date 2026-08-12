import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnPackageBin } from "./spawn-bin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);

const child = spawnPackageBin(
  "vite",
  ["--config", "src/configs/vite.config.ts", ...args],
  {
    cwd: root,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`Failed to start vite: ${err.message}`);
  process.exit(1);
});
