// dist/zeekr-sentry.js is the same code as src/, bundled for pasting into the dashboard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DIST, bundle } from "../scripts/build.mjs";

test("dist/zeekr-sentry.js is up to date with src/ (run npm run build)", async () => {
  assert.ok(existsSync(DIST), "dist/zeekr-sentry.js is missing: run npm run build");
  assert.equal(readFileSync(DIST, "utf8"), await bundle(), "dist/zeekr-sentry.js is stale: run npm run build");
});

test("the single file needs nothing but Web APIs", async () => {
  const code = await bundle();
  assert.doesNotMatch(code, /from\s+["']node:|require\(/);
  assert.match(code, /export\s*\{[^}]*as default|export default/);
});
