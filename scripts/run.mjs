// Node entry (your PC, GitHub Actions): one tick with the same code the Cloudflare Worker runs.
//   node scripts/run.mjs             normal tick, honours DRY_RUN
//   node scripts/run.mjs --dry-run   logs in and reads the car, never sends the command
// Settings: .dev.vars (if present), overridden by environment variables (GitHub secrets).
// State: .state.enc, encrypted.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TAG } from "../src/about.js";
import { ENV_NAMES, run } from "../src/run.js";
import { fileStore } from "./file-store.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readDevVars(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return vars;
}

try {
  const fromEnv = Object.fromEntries(ENV_NAMES.filter((n) => process.env[n]).map((n) => [n, process.env[n]]));
  const env = { ...readDevVars(join(root, ".dev.vars")), ...fromEnv };
  if (process.argv.includes("--dry-run")) env.DRY_RUN = true;
  env.STATE = fileStore(join(root, ".state.enc"), env.ZEEKR_PASSWORD ?? "", env.ZEEKR_EMAIL ?? "");
  if (env.STATE.note) console.log(env.STATE.note);
  await run(env);
} catch (err) {
  console.error(`${TAG} ${err.message}`);
  process.exitCode = 1;
}
