import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { md5 } from "../src/md5.js";

const node = (bytes) => createHash("md5").update(bytes).digest("hex");
const ours = (bytes) => Buffer.from(md5(bytes)).toString("hex");

test("md5 matches Node for padding edges, text and random data", () => {
  assert.equal(ours(new Uint8Array(0)), "d41d8cd98f00b204e9800998ecf8427e");
  for (const n of [1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4096]) {
    const bytes = randomBytes(n);
    assert.equal(ours(bytes), node(bytes), `length ${n}`);
  }
  const text = new TextEncoder().encode('{"command":"start","serviceId":"RSM","zh":"哨兵模式"}');
  assert.equal(ours(text), node(text));
});
