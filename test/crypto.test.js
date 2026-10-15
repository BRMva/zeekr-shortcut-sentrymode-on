// Signatures must match the upstream Python client byte for byte.
// vectors.json was generated with zeekr_ev_api 0.1.15 and dummy keys.

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { appSignature, encryptPassword, encryptVin, gatewayHeaders } from "../src/crypto.js";

const v = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url), "utf8"));

test("gateway HMAC matches Python", async () => {
  for (const c of v.gateway) {
    const h = await gatewayHeaders(c.method, c.url, v.keys.access, v.keys.secret, v.date);
    for (const [k, want] of Object.entries(c.expect)) assert.equal(h[k], want, `${c.method} ${c.url} ${k}`);
  }
});

test("app signature matches Python", async () => {
  for (const c of v.app) {
    assert.equal(await appSignature(c.method, c.url, c.headers, c.body, v.keys.prod), c.expect, `${c.method} ${c.url}`);
  }
});

test("VIN encryption matches Python", async () => {
  assert.equal(await encryptVin(v.vin.plain, v.keys.vinKey, v.keys.vinIv), v.vin.encrypted);
});

test("password encryption is valid RSA PKCS#1 v1.5", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const pkcs1 = publicKey.export({ type: "pkcs1", format: "der" }).toString("base64");
  const jwk = privateKey.export({ format: "jwk" });
  const big = (b64url) => BigInt("0x" + Buffer.from(b64url, "base64url").toString("hex"));
  const n = big(jwk.n);
  const d = big(jwk.d);
  const modPow = (b, e, m) => {
    let r = 1n;
    for (b %= m; e > 0n; e >>= 1n, b = (b * b) % m) if (e & 1n) r = (r * b) % m;
    return r;
  };
  for (const key of [spki, pkcs1]) {
    const c = encryptPassword("pässword-123", key);
    const em = Buffer.from(modPow(big(Buffer.from(c, "base64").toString("base64url")), d, n).toString(16).padStart(512, "0"), "hex");
    assert.equal(Buffer.from(c, "base64").length, 256);
    assert.equal(em[0], 0);
    assert.equal(em[1], 2);
    const sep = em.indexOf(0, 2);
    assert.ok(sep >= 10 && !em.subarray(2, sep).includes(0));
    assert.equal(em.subarray(sep + 1).toString("utf8"), "pässword-123");
  }
});

test("shipped app constants are well-formed", async () => {
  const { APP_CONSTANTS: c } = await import("../src/app-constants.js");
  assert.ok(c.HMAC_ACCESS_KEY.length >= 32 && c.HMAC_SECRET_KEY.length >= 32);
  assert.equal(c.PROD_SECRET.length, 32);
  assert.equal(c.VIN_KEY.length, 16);
  assert.equal(c.VIN_IV.length, 16);
  assert.equal(Buffer.from(encryptPassword("password", c.PASSWORD_PUBLIC_KEY), "base64").length, 128); // RSA-1024
  assert.ok((await encryptVin("LZEKR7X0000000001", c.VIN_KEY, c.VIN_IV)).length > 0);
});
