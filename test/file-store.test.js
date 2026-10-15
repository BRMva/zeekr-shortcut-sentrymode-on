import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStore } from "../scripts/file-store.mjs";

test("state survives a restart, is encrypted, and a wrong password starts fresh", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "zs-")), ".state.enc");
  const a = fileStore(path, "pw", "me@example.com");
  await a.put("session", JSON.stringify({ bearerToken: "SECRET-TOKEN" }));
  await a.put("lastLogin", "123");
  await a.delete("lastLogin");
  assert.ok(!readFileSync(path, "utf8").includes("SECRET-TOKEN"));

  const b = fileStore(path, "pw", "me@example.com");
  assert.equal(b.note, null);
  assert.deepEqual(await b.get("session", { type: "json" }), { bearerToken: "SECRET-TOKEN" });
  assert.equal(await b.get("lastLogin"), null);

  const c = fileStore(path, "other", "me@example.com");
  assert.match(c.note, /starting fresh/);
  assert.equal(await c.get("session"), null);
});
