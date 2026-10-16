// Sentry decision: one pure function from (car reading, remembered parking, config) to an action.
//
// A "parking" starts when the car is first seen parked, and ends when it is seen driving
// or found more than NEW_PARKING_M from where the parking started. Within one parking:
//   - inside a geofence            -> leave sentry alone
//   - sentry seen on at any point  -> done; if it later goes off (owner or car turned it off), respect that
//   - otherwise                    -> turn it on, up to MAX_ATTEMPTS times, once the preconditions hold

export const NEW_PARKING_M = 300;
export const MAX_ATTEMPTS = 3;
export const MIN_BATTERY = 20; // %

const num = (v) => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// Field meanings follow the Home Assistant integration (sensor.py, lock.py, switch.py).
export function readCar(status, remoteState) {
  const basic = status.basicVehicleStatus ?? {};
  const extra = status.additionalVehicleStatus ?? {};
  const lat = num(basic.position?.latitude);
  const lon = num(basic.position?.longitude);
  const lock = extra.drivingSafetyStatus?.centralLockingStatus;
  const sentry = remoteState?.vstdModeState;
  const engine = String(basic.engineStatus ?? "").toLowerCase();
  return {
    engine: engine || "unknown",
    parked: engine === "engine-off" || engine === "charging",
    position: lat !== null && lon !== null && !(lat === 0 && lon === 0) ? { lat, lon } : null,
    locked: lock === undefined || lock === null ? null : String(lock) === "1",
    battery: num(extra.electricVehicleStatus?.chargeLevel),
    sentry: sentry === undefined || sentry === null ? null : ["1", "true"].includes(String(sentry).toLowerCase()),
  };
}

export function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function insideFence(position, fences) {
  return fences.find((f) => distanceM(position, f) <= f.radius_m) ?? null;
}

export const MAX_FENCES = 10;
const DEFAULT_RADIUS_M = 600;

// Text typed with a Chinese or Japanese keyboard: full-width forms (，；．－, digits, letters)
// become ASCII, and 、。−, the ideographic space count as , . - and a space.
const NARROW = { "、": ",", "。": ".", "−": "-", "　": " " };
const narrow = (text) =>
  text.replace(/[！-～、。−　]/g, (c) => NARROW[c] ?? String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// One place per line (or separated by ";"): "Home, 1.3521, 103.8198, 600".
// The name and the radius in metres are optional: "1.3521, 103.8198" is a 600 m fence.
// "none" means no geofences.
export function parseGeofences(text) {
  text = narrow(String(text ?? ""));
  if (text.trim().toLowerCase() === "none") return [];
  const places = text
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (places.length > MAX_FENCES) throw new Error(`at most ${MAX_FENCES} geofences, got ${places.length}`);
  return places.map((place, i) => {
    const parts = place.split(",").map((s) => s.trim());
    const name = parts[0] !== "" && Number.isFinite(Number(parts[0])) ? `place ${i + 1}` : parts.shift();
    const [lat, lon, radius = DEFAULT_RADIUS_M] = parts.map(Number);
    const valid =
      (parts.length === 2 || parts.length === 3) &&
      parts.every((p) => p !== "") &&
      [lat, lon, radius].every(Number.isFinite) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180 &&
      radius > 0;
    if (!valid) throw new Error(`geofence ${i + 1} should look like "Home, 1.3521, 103.8198, 600", got "${place}"`);
    return { name, lat, lon, radius_m: radius };
  });
}

// Returns { parking, action: "enable" | "none", reason }. `parking` is what to remember (null when driving).
export function decide(car, parking, { fences }, now = Date.now()) {
  if (!car.parked) return { parking: null, action: "none", reason: `not parked (${car.engine})` };

  const moved = parking?.position && car.position && distanceM(parking.position, car.position) > NEW_PARKING_M;
  const p = !parking || moved ? { since: now, position: car.position, attempts: 0, seenOn: false } : { ...parking };
  if (!p.position && car.position) p.position = car.position;

  if (car.sentry === true) {
    p.seenOn = true;
    return { parking: p, action: "none", reason: "sentry on" };
  }
  if (p.seenOn) return { parking: p, action: "none", reason: "sentry turned off during this parking, respecting it" };
  if (car.sentry === null) return { parking: p, action: "none", reason: "sentry state unknown" };

  if (fences.length) {
    if (!car.position) return { parking: p, action: "none", reason: "no position, cannot check geofence" };
    const fence = insideFence(car.position, fences);
    if (fence) return { parking: p, action: "none", reason: `inside geofence "${fence.name}"` };
  }
  if (car.locked === false) return { parking: p, action: "none", reason: "not locked yet" };
  if (car.battery !== null && car.battery < MIN_BATTERY) {
    return { parking: p, action: "none", reason: `battery ${car.battery}% below ${MIN_BATTERY}%` };
  }
  if (p.attempts >= MAX_ATTEMPTS) return { parking: p, action: "none", reason: `gave up after ${MAX_ATTEMPTS} attempts` };

  p.attempts += 1;
  return { parking: p, action: "enable", reason: `attempt ${p.attempts}/${MAX_ATTEMPTS}` };
}
