// Builds dist/zeekr-sentry.js: the whole Worker in one file, for people who set it up by
// pasting into the Cloudflare dashboard instead of deploying from GitHub. It is generated
// from src/, so run `npm run build` after changing src/; `npm test` fails while it is stale.

import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { ABOUT } from "../src/about.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = join(root, "dist", "zeekr-sentry.js");

export async function bundle() {
  const banner = [
    `// ${ABOUT.name} ${ABOUT.version} — ${ABOUT.repo} (${ABOUT.license}) by ${ABOUT.author}`,
    "// Turns Zeekr sentry mode on when the car is parked and locked away from your places.",
    "// Single-file version: create a Worker in the Cloudflare dashboard and paste ALL of this file into its code",
    "// editor. Step by step: docs/setup-manual.md in the repository above.",
    "// Based on:",
    ...ABOUT.credits.map((c) => `//   ${c}`),
    "// Built from src/ (npm run build); do not edit by hand.",
  ].join("\n");
  const result = await build({
    entryPoints: [join(root, "src", "index.js")],
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    charset: "utf8",
    legalComments: "none",
    banner: { js: banner },
    write: false,
  });
  return result.outputFiles[0].text;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(DIST, await bundle());
  console.log(`wrote ${DIST}`);
}
