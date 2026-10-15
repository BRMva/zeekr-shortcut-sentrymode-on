import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ABOUT, aboutText } from "../src/about.js";
import worker from "../src/index.js";

test("the version in src/about.js matches package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(ABOUT.version, pkg.version);
  assert.equal(ABOUT.repo, pkg.repository.url);
});

test("the Worker's URL shows what it is, credits, and what setup is missing (names only)", async () => {
  const kv = { get: async () => null, put: async () => {}, delete: async () => {} };
  let text = await (await worker.fetch(new Request("https://x/"), {})).text();
  assert.ok(text.startsWith(aboutText()));
  assert.match(text, /Fryyyyy\/zeekr_ev_api/);
  assert.match(text, /missing: ZEEKR_EMAIL, ZEEKR_PASSWORD, GEOFENCES/);
  assert.match(text, /no storage: bind a KV namespace named STATE/);

  const env = { ZEEKR_EMAIL: "me@example.com", ZEEKR_PASSWORD: "secret-pw", GEOFENCES: "Home, 1.3, 103.8, 800; 1.28, 103.85", STATE: kv };
  text = await (await worker.fetch(new Request("https://x/"), env)).text();
  assert.match(text, /Setup is complete \(geofences: 2\)/);
  assert.doesNotMatch(text, /secret-pw|me@example\.com|103\.8/);

  text = await (await worker.fetch(new Request("https://x/"), { ...env, GEOFENCES: "Home, 1.3" })).text();
  assert.match(text, /geofence 1 should look like/);
});
