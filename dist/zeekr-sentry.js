// zeekr-sentry 0.4.5 [was edited by Manochvarma on 17.10.2026 at 10.54PM (GMT-8)-add the stop button if the GEOFENCE is within the range but due to the fluctuation of coordinates, the Sentry Mode got ON. So this code will check and if it falls on the range it will turn the Sentry Mode to OFF — https://github.com/dts88/zeekr-shortcut-sentrymode-on (MIT) by dts88
// Keeps Zeekr sentry mode off inside configured geofences and turns it on when parked outside them.
// Single-file version: create a Worker in the Cloudflare dashboard and paste ALL of this file into its code
// editor. Step by step: docs/setup-manual.md in the repository above.
// Set GEOFENCES to one fence per line: Name, latitude, longitude, radius-in-metres.
// Each fence supplies its own radius; this Worker does not impose a radius.
// Based on:
//   Fryyyyy/zeekr_ev_api (MIT): Zeekr API, login and request signing
//   Fryyyyy/zeekr_homeassistant (MIT): sentry command and status fields
//   wysie/zeekr_key_extractor (MIT): app constants from the public Zeekr app
//   borconi/openzeekr (MIT): the European servers
// This 0.4.5 variant is based on the published 0.4.4 bundle; only GEOFENCES radius parsing and descriptions were changed.

// src/about.js
var ABOUT = {
  name: "zeekr-sentry",
  version: "0.4.5",
  author: "dts88",
  repo: "https://github.com/dts88/zeekr-shortcut-sentrymode-on",
  license: "MIT",
  credits: [
    "Fryyyyy/zeekr_ev_api (MIT): Zeekr API, login and request signing",
    "Fryyyyy/zeekr_homeassistant (MIT): sentry command and status fields",
    "wysie/zeekr_key_extractor (MIT): app constants from the public Zeekr app",
    "borconi/openzeekr (MIT): the European servers"
  ]
};
var TAG = `[v${ABOUT.version}]`;
function aboutText() {
  return [
    `${ABOUT.name} ${ABOUT.version}`,
    "Keeps Zeekr sentry mode off inside configured geofences and turns it on when parked outside them.",
    `Source: ${ABOUT.repo} (${ABOUT.license}) by ${ABOUT.author}`,
    "Based on:",
    ...ABOUT.credits.map((c) => `  ${c}`)
  ].join("\n");
}

// src/app-constants.js
var APP_CONSTANTS = {
  HMAC_ACCESS_KEY: "edb79b1f68e0430ba192f856617bbcb7",
  HMAC_SECRET_KEY: "8ni9hp2v81ab165f5e744c808e5d48304b6df0e7",
  PASSWORD_PUBLIC_KEY: "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCBzg6+dwMVtGTNo8EPL+XFyz0OY0pMMo3HdRZGauuCSgISfVMkMmOhNEb2q9UfiQcEeOwVmOgts9VF4q0BJYrRNGQaPkLybwkWsx1JmbBRcr3qq+WWhqq8xQFksfn8KeXmwgVMFX+bzup43LE0vy0yyb+SuQ9FBBGuE1d/BfHHpQIDAQAB",
  PROD_SECRET: "890efe3207af95348b95f66b2ee7da04",
  VIN_KEY: "a01a6db985a2f5d4",
  VIN_IV: "ed446b8b8845013d"
};

// src/md5.js
var SHIFT = [
  7,
  12,
  17,
  22,
  7,
  12,
  17,
  22,
  7,
  12,
  17,
  22,
  7,
  12,
  17,
  22,
  5,
  9,
  14,
  20,
  5,
  9,
  14,
  20,
  5,
  9,
  14,
  20,
  5,
  9,
  14,
  20,
  4,
  11,
  16,
  23,
  4,
  11,
  16,
  23,
  4,
  11,
  16,
  23,
  4,
  11,
  16,
  23,
  6,
  10,
  15,
  21,
  6,
  10,
  15,
  21,
  6,
  10,
  15,
  21,
  6,
  10,
  15,
  21
];
var K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32));
function md5(bytes) {
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const msg = new Uint8Array(total);
  msg.set(bytes);
  msg[bytes.length] = 128;
  const view = new DataView(msg.buffer);
  const bits = bytes.length * 8;
  view.setUint32(total - 8, bits >>> 0, true);
  view.setUint32(total - 4, Math.floor(bits / 2 ** 32), true);
  let a0 = 1732584193;
  let b0 = 4023233417;
  let c0 = 2562383102;
  let d0 = 271733878;
  for (let block = 0; block < total; block += 64) {
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f;
      let g;
      if (i < 16) {
        f = b & c | ~b & d;
        g = i;
      } else if (i < 32) {
        f = d & b | ~d & c;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = 7 * i % 16;
      }
      const sum = a + f + K[i] + view.getUint32(block + g * 4, true) | 0;
      a = d;
      d = c;
      c = b;
      b = b + (sum << SHIFT[i] | sum >>> 32 - SHIFT[i]) | 0;
    }
    a0 = a0 + a | 0;
    b0 = b0 + b | 0;
    c0 = c0 + c | 0;
    d0 = d0 + d | 0;
  }
  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((word, i) => outView.setUint32(i * 4, word >>> 0, true));
  return out;
}

// src/crypto.js
var enc = new TextEncoder();
function b64(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(text) {
  const s = atob(text.replace(/\s+/g, ""));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function hmacSha256B64(key, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
async function gatewayHeaders(method, url, accessKey, secretKey, date = (/* @__PURE__ */ new Date()).toUTCString()) {
  const u = new URL(url);
  const segments = u.pathname.split("/").filter(Boolean);
  const path = "/" + segments.join("/");
  const query = u.search.slice(1).split("&").filter((p) => p.includes("=")).map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]).sort((a, b) => a[0].toLowerCase() < b[0].toLowerCase() ? -1 : a[0].toLowerCase() > b[0].toLowerCase() ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
  const signString = [method.toUpperCase(), path, query, accessKey, date].join("\n") + "\n";
  return {
    "X-HMAC-ALGORITHM": "hmac-sha256",
    "X-HMAC-SIGNATURE": await hmacSha256B64(secretKey, signString),
    "X-HMAC-ACCESS-KEY": accessKey,
    "X-HMAC-DIGEST": await hmacSha256B64(secretKey, ""),
    "X-DATE": date
  };
}
var SIGNED_HEADERS = /* @__PURE__ */ new Set([
  "x-app-id",
  "content-type",
  "x-api-signature-nonce",
  "x-timestamp",
  "x-api-signature-version",
  "x-project-id",
  "authorization",
  "accept-language",
  "x-vin",
  "x-device-id",
  "x-platform"
]);
function canonicalJson(value) {
  const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
  return JSON.stringify(sort(value)).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
async function appSignature(method, url, headers, body, secret) {
  const u = new URL(url);
  const headerPart = Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]).filter(([k, v]) => SIGNED_HEADERS.has(k) && (k !== "x-vin" && k !== "authorization" || v !== "")).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([k, v]) => `${k}:${v}
`).join("");
  const params = /* @__PURE__ */ new Map();
  for (const [k, v] of new URLSearchParams(u.search)) if (!params.has(k)) params.set(k, v);
  const query = [...params.keys()].sort().map((k) => `${k}=${params.get(k).replaceAll("%2F", "/").replaceAll("%3F", "?").replaceAll("*", "%2A")}`).join("&");
  let base = headerPart;
  if (query) base += query + "\n";
  const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  if (body && contentType.toLowerCase().includes("application/json")) {
    base += b64(md5(enc.encode(canonicalJson(JSON.parse(body))))) + "\n";
  }
  base += method.toUpperCase() + "\n" + u.pathname.trimEnd();
  return hmacSha256B64(secret, base);
}
async function encryptVin(vin, keyText, ivText) {
  const key = await crypto.subtle.importKey("raw", enc.encode(keyText), { name: "AES-CBC" }, false, ["encrypt"]);
  return b64(await crypto.subtle.encrypt({ name: "AES-CBC", iv: enc.encode(ivText) }, key, enc.encode(vin)));
}
function readDer(bytes, pos) {
  const tag = bytes[pos];
  let len = bytes[pos + 1];
  let start = pos + 2;
  if (len & 128) {
    const n = len & 127;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + bytes[start + i];
    start += n;
  }
  return { tag, start, end: start + len };
}
function bytesToBigInt(bytes) {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt("0x" + (hex || "0"));
}
function parseRsaPublicKey(base64Der) {
  const der = unb64(base64Der);
  let seq = readDer(der, 0);
  let first = readDer(der, seq.start);
  if (first.tag === 48) {
    const bitString = readDer(der, first.end);
    seq = readDer(der, bitString.start + 1);
    first = readDer(der, seq.start);
  }
  const exp = readDer(der, first.end);
  return { n: bytesToBigInt(der.subarray(first.start, first.end)), e: bytesToBigInt(der.subarray(exp.start, exp.end)) };
}
function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = result * base % mod;
    base = base * base % mod;
    exp >>= 1n;
  }
  return result;
}
function encryptPassword(password, publicKeyB64) {
  const { n, e } = parseRsaPublicKey(publicKeyB64);
  const k = Math.ceil(n.toString(16).length / 2);
  const msg = enc.encode(password);
  if (msg.length > k - 11) throw new Error("password too long for RSA key");
  const em = new Uint8Array(k);
  em[1] = 2;
  const ps = em.subarray(2, k - msg.length - 1);
  crypto.getRandomValues(ps);
  for (let i = 0; i < ps.length; i++) while (ps[i] === 0) ps[i] = crypto.getRandomValues(new Uint8Array(1))[0];
  em.set(msg, k - msg.length);
  const c = modPow(bytesToBigInt(em), e, n).toString(16).padStart(k * 2, "0");
  const out = new Uint8Array(k);
  for (let i = 0; i < k; i++) out[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
  return b64(out);
}

// src/zeekr.js
var EU_GATEWAY = "https://gateway-pub-azure.zeekr.eu/";
var FAMILIES = [
  {
    name: "EM",
    area: "Southeast Asia, the Middle East or Latin America",
    appServer: "https://gateway-pub-hw-em-sg.zeekrlife.com/overseas-app/",
    userCenter: "https://gateway-pub-hw-em-sg.zeekrlife.com/zeekr-cuc-idaas-sea/",
    country: "AU"
  },
  {
    name: "EU",
    area: "Europe",
    appServer: `${EU_GATEWAY}overseas-app/`,
    userCenter: `${EU_GATEWAY}zeekr-cuc-idaas/`,
    country: "SE",
    // One set of servers for every country, in the shape of a region-list entry.
    servers: {
      regionCode: "EU",
      url: { appServerUrl: `${EU_GATEWAY}overseas-app/`, userCenterUrl: `${EU_GATEWAY}zeekr-cuc-idaas/` }
    }
  }
];
var LOGIN_SERVERS = {
  SEA: "https://sea-snc-tsp-api-gw.zeekrlife.com/",
  UAE: "https://me-snc-tsp-api-gw.zeekrlife.com/",
  LA: "https://la-snc-tsp-api-gw.zeekrlife.com/",
  EU: "https://eu-snc-tsp-api-gw.zeekrlife.com/"
};
var PROJECT_IDS = { LA: "ZEEKR_LA", EU: "ZEEKR_EU" };
var CLIENT_ID = "1JwLroFkFFIpgFGdTRrm4_nzkkwDkfHj7RxJQb7J8tc";
var GATEWAY_HEADERS = {
  "accept-language": "en-AU",
  "app-authorization": "1003",
  "app-code": "32816dbd-ff17-47b7-e250-5dae7d9f8cd4",
  appcode: "eu-app",
  appid: "TSP",
  appsecret: "zeekr_tis",
  appversion: "1.4.1",
  "call-source": "android",
  "client-id": CLIENT_ID,
  "Content-Type": "application/json; charset=UTF-8",
  "device-name": "sdk_gphone64_x86_64",
  "device-type": "app",
  language: "en",
  msgappid: "11002",
  msgclientid: "1003",
  "tmp-tenant-code": "3300743799505195008",
  "user-agent": "Device/GoogleAppName/com.zeekr.globalAppVersion/1.4.1Platform/androidOSVersion/16Ditto/true"
};
var TIMEOUT_MS = 3e4;
var ZeekrError = class extends Error {
};
var SessionLost = class extends ZeekrError {
};
function sessionLost(result) {
  if (result.msg === "Token expired") return "token expired";
  if (result.code === "079021") return "signed out: the account logged in elsewhere (the Zeekr app or another copy of this program)";
  return null;
}
async function readJson(resp) {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, status: resp.status, error: text.slice(0, 300) };
  }
}
var brief = (r) => JSON.stringify({ code: r?.code, msg: r?.msg, status: r?.status, error: r?.error });
function noAccount(rejected) {
  if (rejected.length === FAMILIES.length) return "Zeekr does not accept the app keys (HMAC_ACCESS_KEY, HMAC_SECRET_KEY)";
  const searched = FAMILIES.filter((f) => !rejected.includes(f.name));
  const where = searched.length === 1 ? ` in ${searched[0].area}` : "";
  const europe = rejected.includes("EU") ? "; a European account needs the keys of the European Zeekr app (see the README)" : "";
  return `no Zeekr account with this email${where}${europe}`;
}
var ZeekrClient = class {
  // secrets: { email, password, hmacAccessKey, hmacSecretKey, passwordPublicKey, prodSecret, vinKey, vinIv }
  // session: the object returned by login(), persisted by the caller
  constructor(secrets, session = null) {
    this.s = secrets;
    this.session = session;
  }
  // ---- transport ----
  async gateway(method, url, body) {
    const headers = {
      ...GATEWAY_HEADERS,
      country: this.family.country,
      registcountry: this.family.country,
      ...await gatewayHeaders(method, url, this.s.hmacAccessKey, this.s.hmacSecretKey)
    };
    if (this.authToken) headers.authorization = this.authToken;
    const resp = await fetch(url, {
      method,
      headers,
      body: body === void 0 ? void 0 : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    return readJson(resp);
  }
  async app(method, path, { query = "", body, vin } = {}) {
    const ss = this.session;
    const url = `${ss.loginServer}${path}${query}`;
    const headers = {
      "ACCEPT-LANGUAGE": "en-AU",
      AppId: "ONEX97FB91F061405",
      authorization: ss.bearerToken ?? "",
      "Content-Type": "application/json; charset=UTF-8",
      "user-agent": "okhttp/4.12.0",
      "X-API-SIGNATURE-VERSION": "2.0",
      "X-APP-ID": "ZEEKRCNCH001M0001",
      "x-app-os-version": "",
      "x-device-id": ss.deviceId,
      "x-p": "Android",
      "X-PLATFORM": "APP",
      "X-PROJECT-ID": ss.projectId,
      "X-API-SIGNATURE-NONCE": crypto.randomUUID(),
      "X-TIMESTAMP": String(Date.now())
    };
    if (vin) headers["X-VIN"] = await encryptVin(vin, this.s.vinKey, this.s.vinIv);
    const text = body === void 0 ? void 0 : JSON.stringify(body);
    headers["X-SIGNATURE"] = await appSignature(method, url, headers, text, this.s.prodSecret);
    const resp = await fetch(url, { method, headers, body: text, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const result = await readJson(resp);
    const lost = sessionLost(result);
    if (lost) throw new SessionLost(lost);
    return result;
  }
  // ---- login (same calls and order as the Python client) ----
  // The country is not a setting: the user directory reports the account's registered country.
  // The session keeps the email it was made for, so a changed ZEEKR_EMAIL means a new login.
  async login() {
    const ss = { deviceId: this.session?.deviceId ?? crypto.randomUUID(), email: this.s.email };
    this.authToken = null;
    const checkUser = (userCenter) => this.gateway("POST", `${userCenter}auth/checkUserV2`, { email: this.s.email, checkType: "1" });
    const rejected = [];
    let urls;
    let who = null;
    for (const family of FAMILIES) {
      this.family = family;
      urls = await this.gateway("GET", `${family.appServer}region/url`);
      if (urls.code === "0001") {
        rejected.push(family.name);
        continue;
      }
      if (!urls.success) throw new ZeekrError(`region lookup failed ${brief(urls)}`);
      const check = await checkUser(family.userCenter);
      if (!check.success) throw new ZeekrError(`user check failed ${brief(check)}`);
      if (check.data?.status === 1 && check.data?.registerCountry) {
        who = check;
        break;
      }
    }
    if (!who) throw new ZeekrError(noAccount(rejected));
    ss.country = who.data.registerCountry;
    const block = this.family.servers ?? (urls.data ?? []).find((b) => (b.countryCode ?? "").toLowerCase() === ss.country.toLowerCase());
    ss.appServer = block?.url?.appServerUrl ?? "";
    ss.userCenter = block?.url?.userCenterUrl ?? "";
    ss.region = block?.regionCode ?? "";
    ss.loginServer = LOGIN_SERVERS[ss.region];
    if (!ss.appServer || !ss.userCenter || !ss.loginServer) {
      throw new ZeekrError(`accounts registered in ${ss.country} are not supported (region ${ss.region || "unknown"})`);
    }
    for (const k of ["appServer", "userCenter"]) if (!ss[k].endsWith("/")) ss[k] += "/";
    ss.projectId = PROJECT_IDS[ss.region] ?? "ZEEKR_SEA";
    if (ss.userCenter !== this.family.userCenter) {
      const check = await checkUser(ss.userCenter);
      if (!check.success) throw new ZeekrError(`user check failed ${brief(check)}`);
    }
    const login = await this.gateway("POST", `${ss.userCenter}auth/loginByEmailEncrypt`, {
      code: "",
      codeId: "",
      email: this.s.email,
      password: encryptPassword(this.s.password, this.s.passwordPublicKey)
    });
    if (!login.success || login.data?.tokenName !== "Authorization" || !login.data?.tokenValue) {
      throw new ZeekrError(`login failed ${brief(login)}`);
    }
    this.authToken = login.data.tokenValue;
    await this.gateway("POST", `${ss.userCenter}user/info`);
    await this.gateway("POST", `${ss.appServer}protocol/service/getProtocol`, { country: ss.country });
    await this.gateway("GET", `${ss.appServer}member/inbox/home`);
    const tsp = await this.gateway("GET", `${ss.userCenter}user/tspCode?tspClientId=${CLIENT_ID}`);
    if (!tsp.success || !tsp.data?.code) throw new ZeekrError(`tsp code failed ${brief(tsp)}`);
    await this.gateway("GET", `${ss.userCenter}user/updateLanguage?language=en`);
    this.session = ss;
    const bearer = await this.app("POST", "ms-user-auth/v1.0/auth/login", {
      body: {
        identifier: tsp.data.code,
        identityType: 10,
        loginDeviceId: "google-sdk_gphone64_x86_64-36-16",
        loginDeviceJgId: "",
        loginDeviceType: 1,
        loginPhoneBrand: "google",
        loginPhoneModel: "sdk_gphone64_x86_64",
        loginSystem: "Android"
      }
    });
    if (!bearer.success || !bearer.data?.accessToken) throw new ZeekrError(`bearer login failed ${brief(bearer)}`);
    ss.bearerToken = bearer.data.accessToken;
    return ss;
  }
  // ---- vehicle calls ----
  async vehicles() {
    const r = await this.app("GET", "ms-app-bff/api/v4.0/veh/vehicle-list", { query: "?needSharedCar=true" });
    if (!r.success) throw new ZeekrError(`vehicle list failed ${brief(r)}`);
    return (r.data ?? []).map((v) => v.vin).filter(Boolean);
  }
  async status(vin) {
    const r = await this.app("GET", "ms-vehicle-status/api/v1.0/vehicle/status/latest", { query: "?latest=false&target=new", vin });
    if (!r.success) throw new ZeekrError(`status failed ${brief(r)}`);
    return r.data ?? {};
  }
  async remoteState(vin) {
    const r = await this.app("GET", "ms-app-bff/api/v1.0/remoteControl/getVehicleState", { vin });
    if (!r.success) throw new ZeekrError(`remote state failed ${brief(r)}`);
    return r.data ?? {};
  }
  // Same command the Home Assistant integration sends to switch Sentry Mode on.
  async startSentry(vin) {
    const r = await this.app("POST", "ms-remote-control/v1.0/remoteControl/control", {
      vin,
      body: { command: "start", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } }
    });
    if (!r.success) throw new ZeekrError(`sentry command rejected ${brief(r)}`);
  }
  // Same command shape as the Home Assistant integration uses to switch Sentry Mode off.
  async stopSentry(vin) {
    const r = await this.app("POST", "ms-remote-control/v1.0/remoteControl/control", {
      vin,
      body: { command: "stop", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } }
    });
    if (!r.success) throw new ZeekrError(`sentry command rejected ${brief(r)}`);
  }
};

// src/sentry.js
var NEW_PARKING_M = 300;
var MAX_ATTEMPTS = 6;
var MIN_BATTERY = 20;
var IN_USE = /* @__PURE__ */ new Set(["4", "13"]);
var num = (v) => v === void 0 || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);
function readCar(status, remoteState) {
  const basic = status.basicVehicleStatus ?? {};
  const extra = status.additionalVehicleStatus ?? {};
  const lat = num(basic.position?.latitude);
  const lon = num(basic.position?.longitude);
  const sentry = remoteState?.vstdModeState;
  const gear = num(extra.drivingBehaviourStatus?.gearAutoStatus);
  const speed = num(basic.speed);
  const usage = basic.usageMode;
  return {
    gear: gear === null ? null : gear === 0 ? "P" : String(gear),
    speed,
    usage: usage === void 0 || usage === null || usage === "" ? null : String(usage),
    position: lat !== null && lon !== null && !(lat === 0 && lon === 0) ? { lat, lon } : null,
    battery: num(extra.electricVehicleStatus?.chargeLevel),
    sentry: sentry === void 0 || sentry === null ? null : ["1", "true"].includes(String(sentry).toLowerCase())
  };
}
function distanceM(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}
function insideFence(position, fences) {
  return fences.find((f) => distanceM(position, f) <= f.radius_m) ?? null;
}
var MAX_FENCES = 10;
var NARROW = { "、": ",", "。": ".", "−": "-", "　": " " };
var narrow = (text) => text.replace(/[！-～、。−　]/g, (c) => NARROW[c] ?? String.fromCharCode(c.charCodeAt(0) - 65248));
function parseGeofences(text) {
  text = narrow(String(text ?? ""));
  if (text.trim().toLowerCase() === "none") return [];
  const places = text.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  if (!places.length && text.trim()) throw new Error(`GEOFENCES has no places; write none for no geofences`);
  if (places.length > MAX_FENCES) throw new Error(`at most ${MAX_FENCES} geofences, got ${places.length}`);
  return places.map((place, i) => {
    const parts = place.split(",").map((s) => s.trim());
    const name = parts[0] !== "" && Number.isFinite(Number(parts[0])) ? `place ${i + 1}` : parts.shift();
    // The radius is intentionally required: every fence uses the radius supplied in GEOFENCES.
    const [lat, lon, radius] = parts.map(Number);
    const valid = parts.length === 3 && parts.every((p) => p !== "") && [lat, lon, radius].every(Number.isFinite) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && radius > 0;
    if (!valid) throw new Error(`geofence ${i + 1} should look like "Home, 1.3521, 103.8198, 50" (name, latitude, longitude, radius in metres)`);
    return { name, lat, lon, radius_m: radius };
  });
}
function decide(car, parking, { fences }) {
  if (car.gear === null) {
    const seen = parking && car.sentry === true && !parking.seenOn ? { ...parking, seenOn: true } : parking;
    return { parking: seen, action: "none", reason: "gear unknown" };
  }
  if (car.gear !== "P") return { parking: null, action: "none", reason: `not parked (gear ${car.gear})` };
  const moved = parking?.position && car.position && distanceM(parking.position, car.position) > NEW_PARKING_M;
  const p = !parking || moved ? { position: car.position, attempts: 0, seenOn: false } : { ...parking };
  if (!p.position && car.position) p.position = car.position;
  if (fences.length) {
    if (!car.position) return { parking: p, action: "none", reason: "no position, cannot check geofence" };
    const fence = insideFence(car.position, fences);
    if (fence) {
      // Home is authoritative: clear any previous manual-off override for the next parking session.
      p.seenOn = false;
      if (car.sentry === null) return { parking: p, action: "none", reason: `inside geofence "${fence.name}", sentry state unknown` };
      if (car.sentry === true) return { parking: p, action: "disable", reason: `inside geofence "${fence.name}"` };
      return { parking: p, action: "none", reason: `inside geofence "${fence.name}", sentry off` };
    }
  }
  if (car.sentry === true) {
    p.seenOn = true;
    return { parking: p, action: "none", reason: "sentry on" };
  }
  if (p.seenOn) return { parking: p, action: "none", reason: "sentry turned off during this parking, respecting it" };
  if (car.sentry === null) return { parking: p, action: "none", reason: "sentry state unknown" };
  if (car.battery !== null && car.battery < MIN_BATTERY) {
    return { parking: p, action: "none", reason: `battery ${car.battery}% below ${MIN_BATTERY}%` };
  }
  if (IN_USE.has(car.usage)) return { parking: p, action: "none", reason: `car in use (usage ${car.usage})` };
  if (p.attempts >= MAX_ATTEMPTS) return { parking: p, action: "none", reason: `gave up after ${MAX_ATTEMPTS} attempts` };
  p.attempts += 1;
  return { parking: p, action: "enable", reason: `attempt ${p.attempts}/${MAX_ATTEMPTS}` };
}

// src/run.js
var log = (message) => console.log(`${TAG} ${message}`);
var LOGIN_MIN_INTERVAL_MS = 30 * 60 * 1e3;
var SECRETS = {
  email: "ZEEKR_EMAIL",
  password: "ZEEKR_PASSWORD",
  hmacAccessKey: "HMAC_ACCESS_KEY",
  hmacSecretKey: "HMAC_SECRET_KEY",
  passwordPublicKey: "PASSWORD_PUBLIC_KEY",
  prodSecret: "PROD_SECRET",
  vinKey: "VIN_KEY",
  vinIv: "VIN_IV"
};
var NO_STORAGE = "no storage: bind a KV namespace named STATE (Worker → Settings → Bindings)";
function setupProblems(env) {
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
async function run(env) {
  const secrets = readSecrets(env);
  const config = readConfig(env);
  if (!env.STATE) throw new Error(NO_STORAGE);
  const client = new ZeekrClient(secrets, await env.STATE.get("session", { type: "json" }));
  const done = /* @__PURE__ */ new Set();
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
var LATEST = ABOUT.repo.replace("https://github.com/", "https://raw.githubusercontent.com/") + "/main/package.json";
async function announceUpdate(now = Date.now()) {
  const t = new Date(now);
  if (t.getUTCHours() !== 0 || t.getUTCMinutes() >= 5) return;
  try {
    const { version } = await (await fetch(LATEST, { signal: AbortSignal.timeout(1e4) })).json();
    if (/^\d+\.\d+\.\d+$/.test(version) && newer(version, ABOUT.version)) {
      log(`version ${version} is available, see ${ABOUT.repo}; to upgrade, Sync fork on GitHub`);
    }
  } catch {
  }
}
function newer(a, b) {
  const [x, y] = [a, b].map((v) => String(v).split(".").map(Number));
  const i = [0, 1, 2].find((k) => x[k] !== y[k]);
  return i !== void 0 && x[i] > y[i];
}
async function ensureSession(client, env, force) {
  const ss = client.session;
  const login = force || !ss?.bearerToken || ss.email !== client.s.email;
  if (login) {
    const last = Number(await env.STATE.get("lastLogin")) || 0;
    const wait = last + LOGIN_MIN_INTERVAL_MS - 6e4 - Date.now();
    if (wait > 0) throw new Error(`login needed but held back for another ${Math.ceil(wait / 6e4)} min`);
    await env.STATE.put("lastLogin", String(Date.now()));
    log(`logging in · ${ABOUT.name} ${ABOUT.version} · ${ABOUT.repo} · based on Fryyyyy/zeekr_ev_api (MIT)`);
    await client.login();
  }
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
        if (config.dryRun) log(`${tag} DRY_RUN, sentry ${action} command not sent`);
        else {
          try {
            if (action === "enable") {
              await client.startSentry(vin);
              log(`${tag} sentry start sent`);
            } else {
              await client.stopSentry(vin);
              log(`${tag} sentry stop sent`);
            }
          } catch (err) {
            if (err instanceof SessionLost) throw err;
            log(`${tag} sentry ${action} failed: ${err.message}`);
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
    `sentry=${car.sentry === null ? "?" : car.sentry ? "on" : "off"}`
  ];
  if (!car.position) parts.push("position=?");
  else if (!fences.length) parts.push("no geofences set");
  else {
    const nearest = fences.map((f) => ({ name: f.name, d: distanceM(car.position, f) })).sort((a, b) => a.d - b.d)[0];
    parts.push(`${Math.round(nearest.d)} m from "${nearest.name}"`);
  }
  return parts.join(" ");
}
function readSecrets(env) {
  const value = (name) => String(env[name] || APP_CONSTANTS[name] || "").trim();
  const missing = [...Object.values(SECRETS), "GEOFENCES"].filter((name) => !value(name));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
  return Object.fromEntries(Object.entries(SECRETS).map(([k, name]) => [k, value(name)]));
}
function readConfig(env) {
  return {
    fences: parseGeofences(env.GEOFENCES),
    dryRun: /^(true|1|yes)$/i.test(String(env.DRY_RUN ?? "").trim())
  };
}

// src/index.js
var index_default = {
  async scheduled(event, env, ctx) {
    try {
      await run(env);
    } catch (err) {
      console.error(`${TAG} ${err.message}`);
      throw err;
    }
  },
  // The Worker's own URL, when it has one (a Worker made in the dashboard does), says what it
  // is and whether its setup is complete. Setting names only, never their values.
  async fetch(request, env) {
    const problems = setupProblems(env);
    const setup = problems.length ? ["Setup is not complete:", ...problems.map((p) => `  ${p}`)] : [`Setup is complete (geofences: ${parseGeofences(env.GEOFENCES).length}). It runs on its cron trigger; see the Worker's Logs.`];
    return new Response([aboutText(), "", ...setup, ""].join("\n"), {
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
export {
  index_default as default
};
