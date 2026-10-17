// One tick: read each car and turn sentry mode on when it is parked outside all geofences.
// `env` carries the settings and the STATE KV namespace.

import { ABOUT, TAG } from "./about.js";
import { APP_CONSTANTS } from "./app-constants.js";
import { SessionLost, ZeekrClient } from "./zeekr.js";
import { decide, distanceM, parseGeofences, readCar } from "./sentry.js";

// Every log line carries the version, so a pasted log says which code wrote it.
const log = (message) => console.log(`${TAG} ${message}`);

// Logging in again signs the account out elsewhere and can trip the account's
// protections, so never more than once per this interval, successful or not.
const LOGIN_MIN_INTERVAL_MS = 30 * 60 * 1000;

const SECRETS = {
  email: "ZEEKR_EMAIL",
  password: "ZEEKR_PASSWORD",
  hmacAccessKey: "HMAC_ACCESS_KEY",
  hmacSecretKey: "HMAC_SECRET_KEY",
  passwordPublicKey: "PASSWORD_PUBLIC_KEY",
  prodSecret: "PROD_SECRET",
  vinKey: "VIN_KEY",
  vinIv: "VIN_IV",
};

const NO_STORAGE = "no storage: bind a KV namespace named STATE (Worker → Settings → Bindings)";

// What stops a tick before it starts, in the same words the tick would fail with.
export function setupProblems(env) {
  const problems = [];
  for (const check of [readSecrets, readConfig]) {
    try {
      check(env);
    } catch (err) {
      problems.push(err.message);
    }
  }
  if (!env.STATE) problems.push(NO_STORAGE);
  return problems;
}

export async function run(env) {
  const secrets = readSecrets(env);
  const config = readConfig(env);
  if (!env.STATE) throw new Error(NO_STORAGE);
  const client = new ZeekrClient(secrets, await env.STATE.get("session", { type: "json" }));
  const done = new Set();
  try {
    await ensureSession(client, env, false);
    await checkCars(client, env, config, done);
  } catch (err) {
    if (!(err instanceof SessionLost)) throw err;
    log(`${err.message}, logging in again`);
    await ensureSession(client, env, true);
    await checkCars(client, env, config, done);
  } finally {
    await announceUpdate();
  }
}

// Once a day, in the tick in the first five minutes after midnight UTC, the log says when the
// public repository has a newer version (a fork upgrades with Sync fork). One small request;
// nothing is stored; no news on failure.
const LATEST = ABOUT.repo.replace("https://github.com/", "https://raw.githubusercontent.com/") + "/main/package.json";

export async function announceUpdate(now = Date.now()) {
  const t = new Date(now);
  if (t.getUTCHours() !== 0 || t.getUTCMinutes() >= 5) return;
  try {
    const { version } = await (await fetch(LATEST, { signal: AbortSignal.timeout(10_000) })).json();
    if (/^\d+\.\d+\.\d+$/.test(version) && newer(version, ABOUT.version)) {
      log(`version ${version} is available, see ${ABOUT.repo}; to upgrade, Sync fork on GitHub`);
    }
  } catch {}
}

function newer(a, b) {
  const [x, y] = [a, b].map((v) => String(v).split(".").map(Number));
  const i = [0, 1, 2].find((k) => x[k] !== y[k]);
  return i !== undefined && x[i] > y[i];
}

async function ensureSession(client, env, force) {
  const ss = client.session;
  const login = force || !ss?.bearerToken || ss.email !== client.s.email;
  if (login) {
    // A minute's slack, so the 5-minute tick right at the interval is not held back to the next one.
    const last = Number(await env.STATE.get("lastLogin")) || 0;
    const wait = last + LOGIN_MIN_INTERVAL_MS - 60_000 - Date.now();
    if (wait > 0) throw new Error(`login needed but held back for another ${Math.ceil(wait / 60000)} min`);
    await env.STATE.put("lastLogin", String(Date.now()));
    log(`logging in · ${ABOUT.name} ${ABOUT.version} · ${ABOUT.repo} · based on Fryyyyy/zeekr_ev_api (MIT)`);
    await client.login();
  }
  // The car list is kept with the session, and asked for again while it is empty. The session is
  // written once (KV takes one write per key per second), and a new login is kept even when the
  // car list fails now.
  if (login || !client.session.vins?.length) {
    try {
      client.session.vins = await client.vehicles();
    } catch (err) {
      if (login) await env.STATE.put("session", JSON.stringify(client.session));
      throw err;
    }
    const s = client.session;
    if (login || s.vins.length) await env.STATE.put("session", JSON.stringify(s));
    log(`${login ? `logged in (${s.country} account, region ${s.region}), ` : ""}${s.vins.length} car(s)`);
  }
}

async function checkCars(client, env, config, done) {
  for (const vin of client.session.vins ?? []) {
    if (done.has(vin)) continue;
    const tag = "car …" + vin.slice(-6);
    try {
      const status = await client.status(vin);
      const remote = await client.remoteState(vin).catch((err) => {
        if (err instanceof SessionLost) throw err;
        log(`${tag} remote state: ${err.message}`);
        return null;
      });
      const car = readCar(status, remote);
      const key = `parking:${vin}`;
      const before = await env.STATE.get(key, { type: "json" });
      const { parking, action, reason } = decide(car, before, config);

      log(`${tag} ${describe(car, config.fences)} -> ${action}: ${reason}`);
      if (action === "enable" || action === "disable") {
        const verb = action === "enable" ? "start" : "stop";

        if (config.dryRun) {
          log(`${tag} DRY_RUN, sentry ${verb} command not sent`);
        } else {
          try {
            if (action === "enable") {
              await client.startSentry(vin);
            } else {
              await client.stopSentry(vin);
            }
            log(`${tag} sentry ${verb} command sent`);
          } catch (err) {
            if (err instanceof SessionLost) throw err;
            log(`${tag} sentry ${verb} failed: ${err.message}`);
          }
        }
      }

      if (!config.dryRun && JSON.stringify(parking) !== JSON.stringify(before)) {
        if (parking) await env.STATE.put(key, JSON.stringify(parking));
        else await env.STATE.delete(key);
      }
      done.add(vin);
    } catch (err) {
      if (err instanceof SessionLost) throw err;
      log(`${tag} error: ${err.message}`);
    }
  }
}

function describe(car, fences) {
  const parts = [
    `gear=${car.gear ?? "?"}`,
    `speed=${car.speed ?? "?"}km/h`,
    `usage=${car.usage ?? "?"}`,
    `battery=${car.battery ?? "?"}%`,
    `sentry=${car.sentry === null ? "?" : car.sentry ? "on" : "off"}`,
  ];
  if (!car.position) parts.push("position=?");
  else if (!fences.length) parts.push("no geofences set");
  else {
    const nearest = fences
      .map((f) => ({ name: f.name, d: distanceM(car.position, f) }))
      .sort((a, b) => a.d - b.d)[0];
    parts.push(`${Math.round(nearest.d)} m from "${nearest.name}"`);
  }
  return parts.join(" ");
}

// GEOFENCES is required too: a missing one must not mean "no geofences" and sentry turned on
// at home. "none" is the explicit way to have no geofences.
function readSecrets(env) {
  const value = (name) => String(env[name] || APP_CONSTANTS[name] || "").trim();
  const missing = [...Object.values(SECRETS), "GEOFENCES"].filter((name) => !value(name));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
  return Object.fromEntries(Object.entries(SECRETS).map(([k, name]) => [k, value(name)]));
}

function readConfig(env) {
  return {
    fences: parseGeofences(env.GEOFENCES),
    dryRun: /^(true|1|yes)$/i.test(String(env.DRY_RUN ?? "").trim()),
  };
}
