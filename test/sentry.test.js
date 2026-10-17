import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ATTEMPTS, decide, distanceM, parseGeofences, readCar } from "../src/sentry.js";

const HOME = { name: "Home", lat: 1.3, lon: 103.8, radius_m: 200 };
const cfg = { fences: [HOME] };
const away = { lat: 1.35, lon: 103.85 };
const car = (o = {}) => ({ gear: "P", speed: 0, position: away, battery: 80, sentry: false, ...o });
const status = (basic, running) => ({
  basicVehicleStatus: { position: { latitude: "1.35", longitude: "103.85" }, ...basic },
  additionalVehicleStatus: { drivingBehaviourStatus: running, electricVehicleStatus: { chargeLevel: "76" } },
});

test("readCar maps the API fields", () => {
  // drivingBehaviourStatus as the car reports it when parked.
  const c = readCar(status({ speed: "0.0" }, { transimissionGearPostion: "", gearAutoStatus: "0", gearManualStatus: "" }), { vstdModeState: "0" });
  assert.deepEqual(c, { gear: "P", speed: 0, usage: null, position: away, battery: 76, sentry: false });
  assert.equal(readCar(status({ usageMode: 1 }, {}), null).usage, "1");
  const unknown = readCar({ basicVehicleStatus: { position: { latitude: "0", longitude: "0" } } }, null);
  assert.equal(unknown.gear, null);
  assert.equal(unknown.speed, null);
  assert.equal(unknown.position, null);
  assert.equal(unknown.sentry, null);
});

test("parked means in P; neither a stray speed nor the (lagging) engine status counts", () => {
  const outcome = (basic, running) => decide({ ...readCar(status(basic, running), { vstdModeState: "0" }), position: away }, null, cfg);
  assert.equal(outcome({ engineStatus: "engine-running", speed: "0" }, { gearAutoStatus: "0" }).action, "enable");
  assert.equal(outcome({ speed: "0" }, { gearAutoStatus: 0 }).action, "enable");
  // Seen on a car charging at home: in P, reporting 7 km/h.
  assert.equal(outcome({ speed: "7" }, { gearAutoStatus: "0" }).action, "enable");
  assert.equal(outcome({ engineStatus: "engine-off", speed: "0" }, { gearAutoStatus: "3" }).reason, "not parked (gear 3)");
  assert.equal(outcome({ speed: "8" }, {}).reason, "gear unknown");
});

test("a reading without a gear keeps the parking as it is: the owner's 'off' is still respected", () => {
  const parked = { position: away, attempts: 1, seenOn: true };
  const r = decide(car({ gear: null }), parked, cfg);
  assert.deepEqual([r.parking, r.action, r.reason], [parked, "none", "gear unknown"]);
  assert.match(decide(car(), r.parking, cfg).reason, /respecting/);
  assert.equal(decide(car({ gear: null }), null, cfg).parking, null);

  // Sentry turned on by attempt 1, seen in a reading without a gear, then switched off by the owner.
  const after = decide(car({ gear: null, sentry: true }), { position: away, attempts: 1, seenOn: false }, cfg);
  assert.equal(after.parking.seenOn, true);
  assert.match(decide(car({ sentry: false }), after.parking, cfg).reason, /respecting/);
});

test("distance is roughly right", () => {
  const d = distanceM({ lat: 1.3, lon: 103.8 }, { lat: 1.301, lon: 103.8 });
  assert.ok(d > 110 && d < 112);
});

test("parked away from fences, sentry off -> enable", () => {
  const r = decide(car(), null, cfg);
  assert.equal(r.action, "enable");
  assert.deepEqual(r.parking, { position: away, attempts: 1, seenOn: false });
});

test("inside geofence -> leave alone, no attempt used", () => {
  const r = decide(car({ position: { lat: 1.3005, lon: 103.8 } }), null, cfg);
  assert.equal(r.action, "none");
  assert.match(r.reason, /inside geofence "Home"/);
  assert.equal(r.parking.attempts, 0);
});

test("driving clears the parking", () => {
  const r = decide(car({ gear: "3", speed: 35 }), { attempts: 2 }, cfg);
  assert.equal(r.parking, null);
  assert.equal(r.action, "none");
  assert.equal(r.reason, "not parked (gear 3)");
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
  assert.equal(MAX_ATTEMPTS, 6);
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

test("waits for enough battery, known sentry state and position", () => {
  assert.equal(decide(car({ battery: 15 }), null, cfg).action, "none");
  assert.equal(decide(car({ battery: null }), null, cfg).action, "enable");
  assert.equal(decide(car({ sentry: null }), null, cfg).action, "none");
  assert.equal(decide(car({ position: null }), null, cfg).action, "none");
  assert.equal(decide(car({ position: null }), null, { fences: [] }).action, "enable");
});

test("while the car is in use (switched on, someone in it) it waits, without using an attempt", () => {
  let r = decide(car({ usage: "13" }), null, cfg);
  assert.equal(r.action, "none");
  assert.equal(r.reason, "car in use (usage 13)");
  assert.equal(r.parking.attempts, 0);
  r = decide(car({ usage: "4" }), r.parking, cfg);
  assert.equal(r.action, "none");
  for (const usage of ["0", "1", "2", null]) assert.equal(decide(car({ usage }), r.parking, cfg).action, "enable", usage);
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

test("geofences: punctuation, digits and spaces from a Chinese or Japanese keyboard", () => {
  const home = { name: "Home", lat: 1.3521, lon: 103.8198, radius_m: 600 };
  assert.deepEqual(parseGeofences("Home，1.3521，103.8198，600"), [home]);
  assert.deepEqual(parseGeofences("Home，１．３５２１，１０３．８１９８，６００"), [home]);
  assert.deepEqual(parseGeofences("Home、1。3521、103。8198"), [home]);
  assert.deepEqual(parseGeofences("　Ｈｏｍｅ，1.3521，103.8198　；家，1.2840，103.8510，50；"), [
    home,
    { name: "家", lat: 1.284, lon: 103.851, radius_m: 50 },
  ]);
  assert.deepEqual(parseGeofences("ホーム, －1.5, −45.25"), [{ name: "ホーム", lat: -1.5, lon: -45.25, radius_m: 600 }]);
  assert.deepEqual(parseGeofences("ｎｏｎｅ"), []);
  assert.throws(() => parseGeofences("Home，1.3521"), /geofence 1 should look like/);
});

test("geofences: at most 10, and bad lines are named", () => {
  assert.equal(parseGeofences(Array.from({ length: 10 }, (_, i) => `P${i}, 1, 103`).join("\n")).length, 10);
  assert.throws(() => parseGeofences(Array.from({ length: 11 }, () => "1, 103").join(";")), /at most 10/);
  for (const bad of ["Home, 1.3", "Home, , 103.9, 800", "Home, 91, 103.9", "Home, 1.3, 103.9, 0", "Home, 1.3, 103.9, 800, 5", "Home"]) {
    assert.throws(() => parseGeofences(bad), /geofence 1 should look like/, bad);
  }
  // Only separators is not "no geofences": that must be written as none.
  for (const empty of [";", " ; ；\n\n", "；"]) assert.throws(() => parseGeofences(empty), /no places; write none/, empty);
});
