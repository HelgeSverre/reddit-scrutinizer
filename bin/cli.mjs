#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entrypoint = resolve(__dirname, "..", "src", "index.ts");

function findBun() {
  // 1. Try the bundled bun dependency
  try {
    const require = createRequire(import.meta.url);
    const bunBin = require.resolve("bun/bin/bun.exe");
    return bunBin;
  } catch {}

  // 2. Try global bun
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return "bun";
  } catch {}

  return null;
}

const bun = findBun();

if (!bun) {
  console.error(
    "Error: bun runtime not found.\n\n" +
      "reddit-scrutinizer requires Bun to run. Install it with:\n\n" +
      "  curl -fsSL https://bun.sh/install | bash\n\n" +
      "Or visit https://bun.sh for more options.",
  );
  process.exit(1);
}

try {
  execFileSync(bun, [entrypoint, ...process.argv.slice(2)], {
    stdio: "inherit",
  });
} catch (err) {
  process.exit(err.status ?? 1);
}
