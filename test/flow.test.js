// Whole tick against a fake Zeekr API: login (EM and European servers), reading the car, sending
// the command, token expiry, the login hold-back, and the daily new-version notice.

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { ABOUT } from "../src/about.js";
import { announceUpdate, run } from "../src/run.js";

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

// The keys of the European app, and Zeekr's two gateway families: each takes only its own keys
// and knows only its own accounts.
const EU_KEYS = { HMAC_ACCESS_KEY: "f".repeat(32), HMAC_SECRET_KEY: "g".repeat(32), PROD_SECRET: "h".repeat(32) };
const GATEWAYS = {
  "gateway-pub-hw-em-sg.zeekrlife.com": { key: SECRETS.HMAC_ACCESS_KEY, country: "AU", accounts: { [SECRETS.ZEEKR_EMAIL]: "SG" } },
  "gateway-pub-azure.zeekr.eu": { key: EU_KEYS.HMAC_ACCESS_KEY, country: "SE", accounts: { "eu@example.com": "NL" } },
};

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
let projectId; // X-PROJECT-ID of the last sentry command
let published; // version in the public repository's package.json; null: unreachable

function fakeApi(url, init) {
  const u = new URL(url);
  const p = u.pathname;
  const headers = new Headers(init.headers);
  const auth = headers.get("authorization");
  calls.push(`${init.method} ${u.host}${p}`);
  if (u.host === "raw.githubusercontent.com") {
    if (published === null) throw new TypeError("fetch failed");
    return new Response(JSON.stringify({ name: "zeekr-shortcut-sentrymode-on", version: published }));
  }
  const ok = (data) => new Response(JSON.stringify({ success: true, code: "000000", data }));
  const gateway = GATEWAYS[u.host];
  if (gateway && headers.get("x-hmac-access-key") !== gateway.key) {
    return new Response(JSON.stringify({ success: false, code: "0001", msg: "Invalid access key" }));
  }
  if (gateway) assert.equal(headers.get("country"), gateway.country);
  if (p.endsWith("/region/url")) {
    if (gateway?.country === "SE") return ok([{ countryCode: "NL" }, { countryCode: "SE" }]);
    return ok([{ countryCode: "SG", regionCode: "SEA", url: { appServerUrl: "https://app.test/", userCenterUrl: "https://uc.test", messageCoreUrl: "https://msg.test/" } }]);
  }
  if (p.endsWith("/auth/checkUserV2")) {
    const country = gateway?.accounts[JSON.parse(init.body).email];
    return ok(country ? { status: 1, registerCountry: country } : { status: 0, registerCountry: null });
  }
  if (p.endsWith("/auth/loginByEmailEncrypt")) return ok({ tokenName: "Authorization", tokenValue: "AUTH" });
  if (p.endsWith("/user/tspCode")) return ok({ code: "TSP", loginId: "L" });
  if (p.endsWith("/ms-user-auth/v1.0/auth/login")) {
    tokenValid = true;
    return ok({ accessToken: "BEARER" });
  }
  if (u.host.endsWith("-snc-tsp-api-gw.zeekrlife.com") && (!tokenValid || auth !== "BEARER")) {
    return new Response(JSON.stringify(SESSION_LOST[lostBy]));
  }
  if (p.endsWith("/vehicle-list")) return ok([{ vin: "VIN0000000000ABC123" }]);
  if (p.endsWith("/status/latest")) {
    return ok({
      basicVehicleStatus: {
        engineStatus: car.engine,
        speed: car.speed ?? "0.0",
        usageMode: car.usage ?? "1",
        position: { latitude: String(car.lat), longitude: String(car.lon) },
      },
      additionalVehicleStatus: { drivingBehaviourStatus: { gearAutoStatus: car.gear ?? "0" }, electricVehicleStatus: { chargeLevel: "80" } },
    });
  }
  if (p.endsWith("/getVehicleState")) return ok({ vstdModeState: car.sentry ? "1" : "0" });
  if (p.endsWith("/remoteControl/control")) {
    assert.deepEqual(JSON.parse(init.body), { command: "start", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } });
    assert.ok(headers.get("x-vin"));
    projectId = headers.get("x-project-id");
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
  published = ABOUT.version;
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

test("the log shows gear and speed; the gear alone says parked, whatever the engine status or speed", async () => {
  car = { engine: "engine-running", gear: "0", speed: "0.0", lat: 1.35, lon: 103.85, sentry: false };
  await run(env(kv()));
  assert.equal(sent(), 1);
  assert.ok(logs.some((l) => /gear=P speed=0km\/h usage=1 battery=80% sentry=off .* -> enable: attempt 1\/6$/.test(l)), logs.join("\n"));

  calls = [];
  logs = [];
  car = { engine: "engine-off", gear: "0", speed: "7", lat: 1.35, lon: 103.85, sentry: false };
  await run(env(kv()));
  assert.equal(sent(), 1);
  assert.ok(logs.some((l) => /gear=P speed=7km\/h usage=1 .* -> enable: attempt 1\/6$/.test(l)), logs.join("\n"));

  calls = [];
  logs = [];
  car = { engine: "engine-running", gear: "3", speed: "38", lat: 1.35, lon: 103.85, sentry: false };
  await run(env(kv()));
  assert.equal(sent(), 0);
  assert.ok(logs.some((l) => /gear=3 speed=38km\/h usage=1 .* -> none: not parked \(gear 3\)$/.test(l)), logs.join("\n"));
});

test("parked with someone in the car: no command until the car is switched off, and no attempt used", async () => {
  const state = kv();
  car = { engine: "engine-running", gear: "0", speed: "0.0", usage: "13", lat: 1.35, lon: 103.85, sentry: false };
  await run(env(state));
  await run(env(state));
  assert.equal(sent(), 0);
  assert.ok(logs.some((l) => /usage=13 .* -> none: car in use \(usage 13\)$/.test(l)), logs.join("\n"));
  assert.equal(JSON.parse(state.m.get("parking:VIN0000000000ABC123")).attempts, 0);

  car.usage = "1";
  await run(env(state));
  assert.equal(sent(), 1);
  assert.ok(logs.some((l) => /usage=1 .* -> enable: attempt 1\/6$/.test(l)), logs.join("\n"));
});

test("an EM account logs in with the same calls as before, on its country's servers", async () => {
  const state = kv();
  await run(env(state));
  assert.deepEqual(calls.slice(0, 4), [
    "GET gateway-pub-hw-em-sg.zeekrlife.com/overseas-app/region/url",
    "POST gateway-pub-hw-em-sg.zeekrlife.com/zeekr-cuc-idaas-sea/auth/checkUserV2",
    "POST uc.test/auth/checkUserV2",
    "POST uc.test/auth/loginByEmailEncrypt",
  ]);
  const session = JSON.parse(state.m.get("session"));
  assert.deepEqual([session.region, session.loginServer, session.projectId], ["SEA", "https://sea-snc-tsp-api-gw.zeekrlife.com/", "ZEEKR_SEA"]);
  assert.equal(projectId, "ZEEKR_SEA");
});

test("a European account with the European app's keys logs in through the European servers", async () => {
  const state = kv();
  await run(env(state, { ZEEKR_EMAIL: "eu@example.com", ...EU_KEYS }));
  const session = JSON.parse(state.m.get("session"));
  assert.deepEqual(
    [session.country, session.region, session.userCenter, session.loginServer, session.projectId],
    ["NL", "EU", "https://gateway-pub-azure.zeekr.eu/zeekr-cuc-idaas/", "https://eu-snc-tsp-api-gw.zeekrlife.com/", "ZEEKR_EU"],
  );
  assert.ok(calls.includes("POST gateway-pub-azure.zeekr.eu/zeekr-cuc-idaas/auth/loginByEmailEncrypt"), calls.join("\n"));
  assert.ok(calls.includes("POST eu-snc-tsp-api-gw.zeekrlife.com/ms-remote-control/v1.0/remoteControl/control"), calls.join("\n"));
  assert.equal(projectId, "ZEEKR_EU");
  assert.ok(logs.some((l) => /logged in \(NL account, region EU\), 1 car\(s\)$/.test(l)), logs.join("\n"));
});

test("a European account with the built-in keys is told it needs the European app's keys", async () => {
  await assert.rejects(
    run(env(kv(), { ZEEKR_EMAIL: "eu@example.com" })),
    /no Zeekr account with this email in Southeast Asia, the Middle East or Latin America; a European account needs the keys of the European Zeekr app/,
  );
  assert.equal(calls.filter((c) => c.endsWith("/loginByEmailEncrypt")).length, 0);
  await assert.rejects(run(env(kv(), { ZEEKR_EMAIL: "stranger@example.com", ...EU_KEYS })), /^Error: no Zeekr account with this email in Europe$/);
});

test("just after midnight UTC, once a day, the log says when a newer version is published", async () => {
  const midnight = Date.parse("2026-10-17T00:01:30Z");
  published = "9.0.0";
  await announceUpdate(midnight);
  assert.deepEqual(logs, [`[v${ABOUT.version}] version 9.0.0 is available, see ${ABOUT.repo}; to upgrade, Sync fork on GitHub`]);
  assert.match(calls[0], / raw\.githubusercontent\.com\/dts88\/zeekr-shortcut-sentrymode-on\/main\/package\.json$/);

  logs = [];
  calls = [];
  await announceUpdate(Date.parse("2026-10-17T00:05:00Z"));
  await announceUpdate(Date.parse("2026-10-17T12:00:00Z"));
  assert.equal(calls.length, 0);
  for (published of [ABOUT.version, "0.0.1", "not a version", null]) await announceUpdate(midnight);
  assert.deepEqual(logs, []);
});
