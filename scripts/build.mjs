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
    "// 极氪哨兵自动开启：车停好、锁上，且不在你设定的地点附近时，自动打开哨兵模式。",
    "// 单文件版本：在 Cloudflare 控制台新建 Worker，把本文件全部内容粘贴进代码编辑器，步骤见 docs/setup-zh.md。",
    "// Based on:",
    ...ABOUT.credits.map((c) => `//   ${c}`),
    "// Single-file build of src/ (npm run build). Paste all of it into the Worker's code editor; do not edit by hand.",
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
