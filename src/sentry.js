
 // Sentry decision: choose an action from the car reading, remembered parking and config.

export const NEW_PARKING_M = 300;
export const MAX_ATTEMPTS = 6;
export const MIN_BATTERY = 20; // %

const IN_USE = new Set(["4", "13"]);

const num = (v) =>
  v === undefined || v === null || v === "" || Number.isNaN(Number(v))
    ? null
    : Number(v);

export function readCar(status, remoteState) {
  const basic = status.basicVehicleStatus ?? {};
  const extra = status.additionalVehicleStatus ?? {};
  const lat = num(basic.position?.latitude);
  const lon = num(basic.position?.longitude);
  const sentry = remoteState?.vstdModeState;
  const gear = num(extra.drivingBehaviourStatus?.gearAutoStatus);

  return {
    gear: gear === null ? null : gear === 0 ? "P" : String(gear),
    speed: num(basic.speed),
    usage:
      basic.usageMode === undefined ||
      basic.usageMode === null ||
      basic.usageMode === ""
        ? null
        : String(basic.usageMode),
    position:
      lat !== null && lon !== null && !(lat === 0 && lon === 0)
        ? { lat, lon }
        : null,
    battery: num(extra.electricVehicleStatus?.chargeLevel),
    sentry:
      sentry === undefined || sentry === null
        ? null
        : ["1", "true"].includes(String(sentry).toLowerCase()),
  };
}

export function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function insideFence(position, fences) {
  return fences.find((f) => distanceM(position, f) <= f.radius_m) ?? null;
}

export const MAX_FENCES = 10;
const DEFAULT_RADIUS_M = 600;

const NARROW = { "、": ",", "。": ".", "−": "-", "　": " " };

const narrow = (text) =>
  text.replace(/[！-～、。−　]/g, (c) =>
    NARROW[c] ?? String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

// Format:
// Home, latitude, longitude, radius_in_metres
// Radius is optional; the existing default is 600 m.
// Use "none" if no geofences are wanted.
export function parseGeofences(text) {
  text = narrow(String(text ?? ""));

  if (text.trim().toLowerCase() === "none") return [];

  const places = text
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!places.length && text.trim()) {
    throw new Error("GEOFENCES has no places; write none for no geofences");
  }

  if (places.length > MAX_FENCES) {
    throw new Error(`at most ${MAX_FENCES} geofences, got ${places.length}`);
  }

  return places.map((place, i) => {
    const parts = place.split(",").map((s) => s.trim());
    const name =
      parts[0] !== "" && Number.isFinite(Number(parts[0]))
        ? `place ${i + 1}`
        : parts.shift();

    const [lat, lon, radius = DEFAULT_RADIUS_M] = parts.map(Number);

    const valid =
      (parts.length === 2 || parts.length === 3) &&
      parts.every((p) => p !== "") &&
      [lat, lon, radius].every(Number.isFinite) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180 &&
      radius > 0;

    if (!valid) {
      throw new Error(
        `geofence ${i + 1} should look like "Home, 1.3521, 103.8198, 600"`
      );
    }

    return { name, lat, lon, radius_m: radius };
  });
}

// Actions: "enable", "disable", "none".
export function decide(car, parking, { fences }) {
if (car.gear === null) {
  const updatedParking =
    parking && car.sentry === true
      ? { ...parking, seenOn: true }
      : parking;

  return {
    parking: updatedParking,
    action: "none",
    reason: "gear unknown",
  };
}

  if (car.gear !== "P") {
    return {
      parking: null,
      action: "none",
      reason: `not parked (gear ${car.gear})`,
    };
  }

  const moved =
    parking?.position &&
    car.position &&
    distanceM(parking.position, car.position) > NEW_PARKING_M;

  const p =
    !parking || moved
      ? {
          position: car.position,
          attempts: 0,
          seenOn: false,
        }
      : {
          ...parking,
          attempts: parking.attempts ?? 0,
          seenOn: parking.seenOn ?? false,
          manualOff: parking.manualOff ?? false,
        };

  if (!p.position && car.position) p.position = car.position;

  // Cannot safely decide where the car is if configured fences exist
  // but the current GPS position is unavailable.
  if (fences.length && !car.position) {
    return {
      parking: p,
      action: "none",
      reason: "no position, cannot check geofence",
    };
  }

  const fence = car.position ? insideFence(car.position, fences) : null;

  // HOME: Sentry must be OFF. Clear the manual-off override so a
  // subsequent away parking session can enable Sentry again.
  if (fence) {
    p.seenOn = false;
    p.manualOff = false;
    p.attempts = 0;

    if (car.sentry === true) {
      return {
        parking: p,
        action: "disable",
        reason: `inside geofence "${fence.name}", turning sentry off`,
      };
    }

    return {
      parking: p,
      action: "none",
      reason:
        car.sentry === false
          ? `inside geofence "${fence.name}", sentry already off`
          : `inside geofence "${fence.name}", sentry state unknown`,
    };
  }

  // If Sentry was on during this parking session and is now off,
  // respect the owner's decision. Do not turn it straight back on.
  if (car.sentry === true) {
    p.seenOn = true;
    p.manualOff = false;

    return {
      parking: p,
      action: "none",
      reason: "sentry on",
    };
  }

  if (p.seenOn) {
    p.manualOff = true;

    return {
      parking: p,
      action: "none",
      reason: "sentry turned off during this parking, respecting it",
    };
  }

  if (p.manualOff) {
    return {
      parking: p,
      action: "none",
      reason: "manual sentry off override",
    };
  }

  if (car.sentry === null) {
    return {
      parking: p,
      action: "none",
      reason: "sentry state unknown",
    };
  }

  if (car.battery !== null && car.battery < MIN_BATTERY) {
    return {
      parking: p,
      action: "none",
      reason: `battery ${car.battery}% below ${MIN_BATTERY}%`,
    };
  }

  if (IN_USE.has(car.usage)) {
    return {
      parking: p,
      action: "none",
      reason: `car in use (usage ${car.usage})`,
    };
  }

  if (p.attempts >= MAX_ATTEMPTS) {
    return {
      parking: p,
      action: "none",
      reason: `gave up after ${MAX_ATTEMPTS} attempts`,
    };
  }

  p.attempts += 1;

  return {
    parking: p,
    action: "enable",
    reason: `attempt ${p.attempts}/${MAX_ATTEMPTS}`,
  };
}
