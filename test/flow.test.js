// Whole tick against a fake Zeekr API: login, reading the car, sending the command,
// token expiry, and the login hold-back.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { run } from "../src/run.js";

const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SECRETS = {
  ZEEKR_EMAIL: "me@example.com",
  ZEEKR_PASSWORD: "pw",
  HMAC_ACCESS_KEY: "a".repeat(32),
  HMAC_SECRET_KEY: "b".repeat(32),
  PASSWORD_PUBLIC_KEY: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  PROD_SECRET: "c".repeat(32),
  VIN_KEY: "d".repeat(16),
  VIN_IV: "e".repeat(16),
};
const HOME = { name: "Home", lat: 1.3, lon: 103.8, radius_m: 200 };

function kv() {
  const m = new Map();
  return {
    m,
    async get(k, o) {
      const v = m.get(k);
      return v === undefined ? null : o?.type === "json" ? JSON.parse(v) : v;
    },
    async put(k, v) {
      m.set(k, v);
    },
    async delete(k) {
      m.delete(k);
    },
  };
}

// What the TSP gateway answers once the bearer token is no longer valid.
const SESSION_LOST = {
  expiry: { success: false, msg: "Token expired" },
  "a login elsewhere": { success: false, code: "079021", msg: "The account is currently logged in elsewhere." },
};

let car;
let calls;
let logs;
let tokenValid;
let lostBy;

function fakeApi(url, init) {
  const u = new URL(url);
  const p = u.pathname;
  const auth = new Headers(init.headers).get("authorization");
  calls.push(`${init.method} ${p}`);
  const ok = (data) => new Response(JSON.stringify({ success: true, code: "000000", data }));
  if (p.endsWith("/region/url")) {
    return ok([{ countryCode: "SG", regionCode: "SEA", url: { appServerUrl: "https://app.test/", userCenterUrl: "https://uc.test", messageCoreUrl: "https://msg.test/" } }]);
  }
  if (p.endsWith("/auth/checkUserV2")) {
    const known = JSON.parse(init.body).email === SECRETS.ZEEKR_EMAIL;
    return ok(known ? { status: 1, registerCountry: "SG", registerSite: "sea" } : { status: 0, registerCountry: null });
  }
  if (p.endsWith("/auth/loginByEmailEncrypt")) return ok({ tokenName: "Authorization", tokenValue: "AUTH" });
  if (p.endsWith("/user/tspCode")) return ok({ code: "TSP", loginId: "L" });
  if (p.endsWith("/ms-user-auth/v1.0/auth/login")) {
    tokenValid = true;
    return ok({ accessToken: "BEARER" });
  }
  if (u.host === "sea-snc-tsp-api-gw.zeekrlife.com" && (!tokenValid || auth !== "BEARER")) {
    return new Response(JSON.stringify(SESSION_LOST[lostBy]));
  }
  if (p.endsWith("/vehicle-list")) return ok([{ vin: "VIN0000000000ABC123" }]);
  if (p.endsWith("/status/latest")) {
    return ok({
      basicVehicleStatus: { engineStatus: car.engine, position: { latitude: String(car.lat), longitude: String(car.lon) } },
      additionalVehicleStatus: { drivingSafetyStatus: { centralLockingStatus: "1" }, electricVehicleStatus: { chargeLevel: "80" } },
    });
  }
  if (p.endsWith("/getVehicleState")) return ok({ vstdModeState: car.sentry ? "1" : "0" });
  if (p.endsWith("/remoteControl/control")) {
    assert.deepEqual(JSON.parse(init.body), { command: "start", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } });
    assert.ok(new Headers(init.headers).get("x-vin"));
    return ok(null);
  }
  return ok({});
}

const env = (state, vars = {}) => ({ ...SECRETS, GEOFENCES: "Home, 1.3, 103.8, 200", DRY_RUN: false, STATE: state, ...vars });
const sent = () => calls.filter((c) => c.endsWith("/remoteControl/control")).length;

beforeEach(() => {
  calls = [];
  logs = [];
  tokenValid = false;
  lostBy = "expiry";
  car = { engine: "engine-off", lat: 1.35, lon: 103.85, sentry: false };
  globalThis.fetch = async (url, init) => fakeApi(url, init);
  console.log = (line) => logs.push(line);
});

test("first tick logs in once and turns sentry on away from home", async () => {
  const state = kv();
  await run(env(state));
  assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 1);
  assert.equal(sent(), 1);
  assert.equal(JSON.parse(state.m.get("session")).bearerToken, "BEARER");
  assert.equal(JSON.parse(state.m.get("parking:VIN0000000000ABC123")).attempts, 1);

  calls = [];
  car.sentry = true;
  await run(env(state));
  assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 0);
  assert.equal(sent(), 0);
});

test("at home nothing is sent", async () => {
  car = { engine: "engine-off", lat: 1.3005, lon: 103.8, sentry: false };
  await run(env(kv()));
  assert.equal(sent(), 0);
});

test("dry run reads but does not send or remember", async () => {
  const state = kv();
  await run(env(state, { DRY_RUN: "true" }));
  assert.equal(sent(), 0);
  assert.equal(state.m.has("parking:VIN0000000000ABC123"), false);
});

for (const [why, said] of [
  ["expiry", /token expired, logging in again/],
  ["a login elsewhere", /signed out: the account logged in elsewhere .*, logging in again/],
]) {
  test(`session ended by ${why}: logs in again once, says why, and carries on`, async () => {
    const state = kv();
    await run(env(state));
    state.m.set("lastLogin", "0");
    tokenValid = false;
    lostBy = why;
    calls = [];
    logs = [];
    car = { engine: "engine-off", lat: 1.4, lon: 103.9, sentry: false };
    await run(env(state));
    assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 1);
    assert.equal(sent(), 1);
    assert.ok(logs.some((l) => said.test(l)), logs.join("\n"));
    assert.ok(!logs.some((l) => / error: /.test(l)), logs.join("\n"));
  });

  test(`session ended by ${why} within the hold-back: no second login`, async () => {
    const state = kv();
    await run(env(state));
    tokenValid = false;
    lostBy = why;
    calls = [];
    await assert.rejects(run(env(state)), /held back/);
    assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 0);
  });
}

test("missing secrets are named", async () => {
  await assert.rejects(run({ STATE: kv() }), /missing: ZEEKR_EMAIL, ZEEKR_PASSWORD/);
});

test("the country comes from the account; an unknown email is named as such", async () => {
  const state = kv();
  await run(env(state));
  assert.equal(JSON.parse(state.m.get("session")).country, "SG");
  await assert.rejects(run(env(kv(), { ZEEKR_EMAIL: "stranger@example.com" })), /no Zeekr account with this email/);
});

test("GEOFENCES must be set: missing stops before login, 'none' means no geofences", async () => {
  await assert.rejects(run(env(kv(), { GEOFENCES: "" })), /missing: GEOFENCES/);
  assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 0);
  car = { engine: "engine-off", lat: 1.3005, lon: 103.8, sentry: false };
  await run(env(kv(), { GEOFENCES: "none" }));
  assert.equal(sent(), 1);
});

test("a missing STATE binding is named before anything else happens", async () => {
  const { STATE, ...noStorage } = env(kv());
  await assert.rejects(run(noStorage), /no storage: bind a KV namespace named STATE/);
  assert.equal(calls.length, 0);
});
