import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, decide, distanceM, parseGeofences, readCar } from "../src/sentry.js";

const HOME = { name: "Home", lat: 1.3, lon: 103.8, radius_m: 200 };
const cfg = { fences: [HOME] };
const away = { lat: 1.35, lon: 103.85 };
const car = (o = {}) => ({ engine: "engine-off", parked: true, position: away, locked: true, battery: 80, sentry: false, ...o });

test("readCar maps the API fields", () => {
  const c = readCar(
    {
      basicVehicleStatus: { engineStatus: "engine-off", position: { latitude: "1.35", longitude: "103.85" } },
      additionalVehicleStatus: { drivingSafetyStatus: { centralLockingStatus: "1" }, electricVehicleStatus: { chargeLevel: "76" } },
    },
    { vstdModeState: "0" },
  );
  assert.deepEqual(c, { engine: "engine-off", parked: true, position: away, locked: true, battery: 76, sentry: false });
  const unknown = readCar({ basicVehicleStatus: { position: { latitude: "0", longitude: "0" } } }, null);
  assert.equal(unknown.parked, false);
  assert.equal(unknown.position, null);
  assert.equal(unknown.sentry, null);
  assert.equal(unknown.locked, null);
});

test("distance is roughly right", () => {
  const d = distanceM({ lat: 1.3, lon: 103.8 }, { lat: 1.301, lon: 103.8 });
  assert.ok(d > 110 && d < 112);
});

test("parked away from fences, locked, sentry off -> enable", () => {
  const r = decide(car(), null, cfg, 1000);
  assert.equal(r.action, "enable");
  assert.equal(r.parking.attempts, 1);
  assert.equal(r.parking.since, 1000);
});

test("inside geofence -> leave alone, no attempt used", () => {
  const r = decide(car({ position: { lat: 1.3005, lon: 103.8 } }), null, cfg);
  assert.equal(r.action, "none");
  assert.match(r.reason, /inside geofence "Home"/);
  assert.equal(r.parking.attempts, 0);
});

test("driving clears the parking", () => {
  const r = decide(car({ engine: "engine-running", parked: false }), { attempts: 2 }, cfg);
  assert.equal(r.parking, null);
  assert.equal(r.action, "none");
});

test("gives up after MAX_ATTEMPTS in one parking", () => {
  let p = null;
  let sent = 0;
  for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
    const r = decide(car(), p, cfg);
    if (r.action === "enable") sent++;
    p = r.parking;
  }
  assert.equal(sent, MAX_ATTEMPTS);
});

test("once seen on, a later off is respected", () => {
  let r = decide(car(), null, cfg);
  r = decide(car({ sentry: true }), r.parking, cfg);
  assert.equal(r.parking.seenOn, true);
  r = decide(car({ sentry: false }), r.parking, cfg);
  assert.equal(r.action, "none");
  assert.match(r.reason, /respecting/);
});

test("moving to a new spot without being seen driving starts a new parking", () => {
  let r = decide(car({ sentry: true }), null, cfg);
  r = decide(car({ position: { lat: 1.4, lon: 103.9 } }), r.parking, cfg);
  assert.equal(r.action, "enable");
  assert.equal(r.parking.seenOn, false);
});

test("waits for lock, enough battery, known sentry state and position", () => {
  assert.equal(decide(car({ locked: false }), null, cfg).action, "none");
  assert.equal(decide(car({ locked: null }), null, cfg).action, "enable");
  assert.equal(decide(car({ battery: 15 }), null, cfg).action, "none");
  assert.equal(decide(car({ battery: null }), null, cfg).action, "enable");
  assert.equal(decide(car({ sentry: null }), null, cfg).action, "none");
  assert.equal(decide(car({ position: null }), null, cfg).action, "none");
  assert.equal(decide(car({ position: null }), null, { fences: [] }).action, "enable");
});

test("geofences: one place per line or per ';', name and radius optional", () => {
  const text = "Home, 1.3521, 103.8198, 800\n 1.28, 103.85 ;家, 1.3, 103.8, 50\n\n";
  assert.deepEqual(parseGeofences(text), [
    { name: "Home", lat: 1.3521, lon: 103.8198, radius_m: 800 },
    { name: "place 2", lat: 1.28, lon: 103.85, radius_m: 600 },
    { name: "家", lat: 1.3, lon: 103.8, radius_m: 50 },
  ]);
  assert.deepEqual(parseGeofences(undefined), []);
  assert.deepEqual(parseGeofences(""), []);
  assert.deepEqual(parseGeofences(" None "), []);
});

test("geofences: at most 10, and bad lines are named", () => {
  assert.equal(parseGeofences(Array.from({ length: 10 }, (_, i) => `P${i}, 1, 103`).join("\n")).length, 10);
  assert.throws(() => parseGeofences(Array.from({ length: 11 }, () => "1, 103").join(";")), /at most 10/);
  for (const bad of ["Home, 1.3", "Home, , 103.9, 800", "Home, 91, 103.9", "Home, 1.3, 103.9, 0", "Home, 1.3, 103.9, 800, 5", "Home"]) {
    assert.throws(() => parseGeofences(bad), /geofence 1 should look like/, bad);
  }
});
