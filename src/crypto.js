// Request signing and encryption for the Zeekr overseas API.
// Ported from Fryyyyy/zeekr_ev_api (MIT): zeekr_hmac.py, zeekr_app_sig.py, client.py.

import { md5 } from "./md5.js";

const enc = new TextEncoder();

export function b64(bytes) {
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

// ---- Gateway HMAC (user-center / app-server calls before the bearer login) ----

// The Python client builds these requests with requests.Request(json=...), whose
// .data is empty, so the digest is always taken over "". Kept identical on purpose.
export async function gatewayHeaders(method, url, accessKey, secretKey, date = new Date().toUTCString()) {
  const u = new URL(url);
  const segments = u.pathname.split("/").filter(Boolean);
  const path = "/" + segments.join("/");
  const query = u.search
    .slice(1)
    .split("&")
    .filter((p) => p.includes("="))
    .map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)])
    .sort((a, b) => (a[0].toLowerCase() < b[0].toLowerCase() ? -1 : a[0].toLowerCase() > b[0].toLowerCase() ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signString = [method.toUpperCase(), path, query, accessKey, date].join("\n") + "\n";
  return {
    "X-HMAC-ALGORITHM": "hmac-sha256",
    "X-HMAC-SIGNATURE": await hmacSha256B64(secretKey, signString),
    "X-HMAC-ACCESS-KEY": accessKey,
    "X-HMAC-DIGEST": await hmacSha256B64(secretKey, ""),
    "X-DATE": date,
  };
}

// ---- App signature (TSP gateway calls after the bearer login) ----

const SIGNED_HEADERS = new Set([
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
  "x-platform",
]);

// Python json.dumps(sort_keys=True, separators=(",", ":")) with ensure_ascii.
export function canonicalJson(value) {
  const sort = (v) =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
        : v;
  return JSON.stringify(sort(value)).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

export async function appSignature(method, url, headers, body, secret) {
  const u = new URL(url);
  const headerPart = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), String(v)])
    .filter(([k, v]) => SIGNED_HEADERS.has(k) && ((k !== "x-vin" && k !== "authorization") || v !== ""))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}:${v}\n`)
    .join("");

  const params = new Map();
  for (const [k, v] of new URLSearchParams(u.search)) if (!params.has(k)) params.set(k, v);
  const query = [...params.keys()]
    .sort()
    .map((k) => `${k}=${params.get(k).replaceAll("%2F", "/").replaceAll("%3F", "?").replaceAll("*", "%2A")}`)
    .join("&");

  let base = headerPart;
  if (query) base += query + "\n";
  const contentType = Object.entries(headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
  if (body && contentType.toLowerCase().includes("application/json")) {
    base += b64(md5(enc.encode(canonicalJson(JSON.parse(body))))) + "\n";
  }
  base += method.toUpperCase() + "\n" + u.pathname.trimEnd();
  return hmacSha256B64(secret, base);
}

// ---- VIN: AES-128-CBC, PKCS#7, key/IV used as UTF-8 text ----

export async function encryptVin(vin, keyText, ivText) {
  const key = await crypto.subtle.importKey("raw", enc.encode(keyText), { name: "AES-CBC" }, false, ["encrypt"]);
  return b64(await crypto.subtle.encrypt({ name: "AES-CBC", iv: enc.encode(ivText) }, key, enc.encode(vin)));
}

// ---- Password: RSA PKCS#1 v1.5 (WebCrypto has no RSAES-PKCS1-v1_5, so done by hand) ----

function readDer(bytes, pos) {
  const tag = bytes[pos];
  let len = bytes[pos + 1];
  let start = pos + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
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

// Accepts SubjectPublicKeyInfo (X.509) or bare PKCS#1 RSAPublicKey, base64 DER.
function parseRsaPublicKey(base64Der) {
  const der = unb64(base64Der);
  let seq = readDer(der, 0);
  let first = readDer(der, seq.start);
  if (first.tag === 0x30) {
    const bitString = readDer(der, first.end);
    seq = readDer(der, bitString.start + 1); // skip the unused-bits byte
    first = readDer(der, seq.start);
  }
  const exp = readDer(der, first.end);
  return { n: bytesToBigInt(der.subarray(first.start, first.end)), e: bytesToBigInt(der.subarray(exp.start, exp.end)) };
}

function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

export function encryptPassword(password, publicKeyB64) {
  const { n, e } = parseRsaPublicKey(publicKeyB64);
  const k = Math.ceil(n.toString(16).length / 2);
  const msg = enc.encode(password);
  if (msg.length > k - 11) throw new Error("password too long for RSA key");
  const em = new Uint8Array(k);
  em[1] = 0x02;
  const ps = em.subarray(2, k - msg.length - 1);
  crypto.getRandomValues(ps);
  for (let i = 0; i < ps.length; i++) while (ps[i] === 0) ps[i] = crypto.getRandomValues(new Uint8Array(1))[0];
  em.set(msg, k - msg.length);
  const c = modPow(bytesToBigInt(em), e, n).toString(16).padStart(k * 2, "0");
  const out = new Uint8Array(k);
  for (let i = 0; i < k; i++) out[i] = parseInt(c.slice(i * 2, i * 2 + 2), 16);
  return b64(out);
}
