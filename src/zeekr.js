// Minimal Zeekr overseas API client: login, vehicle list, status, sentry mode.
// Endpoints, headers and login sequence follow Fryyyyy/zeekr_ev_api (MIT) v0.1.15.

import { appSignature, encryptPassword, encryptVin, gatewayHeaders } from "./crypto.js";

// Zeekr's overseas servers come in two families, and each gateway answers only its own family's
// app keys:
//   EM: Southeast Asia, the Middle East and Latin America. One user directory, and a region list
//       that names each country's servers. The built-in keys are EM's.
//   EU: Europe. One set of servers for every country; the keys come from the European app.
// The keys in use decide which family answers, and its directory says where the account is.
// `country` is what the gateway headers carry: AU as zeekr_ev_api sends it, SE as openzeekr does.
const EU_GATEWAY = "https://gateway-pub-azure.zeekr.eu/";
const FAMILIES = [
  {
    name: "EM",
    area: "Southeast Asia, the Middle East or Latin America",
    appServer: "https://gateway-pub-hw-em-sg.zeekrlife.com/overseas-app/",
    userCenter: "https://gateway-pub-hw-em-sg.zeekrlife.com/zeekr-cuc-idaas-sea/",
    country: "AU",
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
      url: { appServerUrl: `${EU_GATEWAY}overseas-app/`, userCenterUrl: `${EU_GATEWAY}zeekr-cuc-idaas/` },
    },
  },
];

const LOGIN_SERVERS = {
  SEA: "https://sea-snc-tsp-api-gw.zeekrlife.com/",
  UAE: "https://me-snc-tsp-api-gw.zeekrlife.com/",
  LA: "https://la-snc-tsp-api-gw.zeekrlife.com/",
  EU: "https://eu-snc-tsp-api-gw.zeekrlife.com/",
};

// X-PROJECT-ID, as zeekr_ev_api and openzeekr both send it; any other region gets ZEEKR_SEA.
const PROJECT_IDS = { LA: "ZEEKR_LA", EU: "ZEEKR_EU" };

const CLIENT_ID = "1JwLroFkFFIpgFGdTRrm4_nzkkwDkfHj7RxJQb7J8tc";

// Sent as-is to every gateway, with the family's country and registcountry added.
const GATEWAY_HEADERS = {
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
  "user-agent": "Device/GoogleAppName/com.zeekr.globalAppVersion/1.4.1Platform/androidOSVersion/16Ditto/true",
};

const TIMEOUT_MS = 30_000;

export class ZeekrError extends Error {}
// The bearer session is gone and only a new login brings it back.
export class SessionLost extends ZeekrError {}

// How the TSP gateway says the bearer session is gone. Logging in anywhere else with the same
// account (the Zeekr app, another copy of this program) ends this session.
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

const brief = (r) => JSON.stringify({ code: r?.code, msg: r?.msg, status: r?.status, error: r?.error });

// Why no family knew the account. `rejected`: the families whose gateway refused the keys.
function noAccount(rejected) {
  if (rejected.length === FAMILIES.length) return "Zeekr does not accept the app keys (HMAC_ACCESS_KEY, HMAC_SECRET_KEY)";
  const searched = FAMILIES.filter((f) => !rejected.includes(f.name));
  const where = searched.length === 1 ? ` in ${searched[0].area}` : "";
  const europe = rejected.includes("EU") ? "; a European account needs the keys of the European Zeekr app (see the README)" : "";
  return `no Zeekr account with this email${where}${europe}`;
}

export class ZeekrClient {
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
      ...(await gatewayHeaders(method, url, this.s.hmacAccessKey, this.s.hmacSecretKey)),
    };
    if (this.authToken) headers.authorization = this.authToken;
    const resp = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
      "X-TIMESTAMP": String(Date.now()),
    };
    if (vin) headers["X-VIN"] = await encryptVin(vin, this.s.vinKey, this.s.vinIv);
    const text = body === undefined ? undefined : JSON.stringify(body);
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

    // Each family in turn: its region list (a gateway refusing the keys answers 0001 "Invalid access
    // key"), then its user directory. The first family that knows the email is the account's.
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

    // EM names each country's servers in its region list; EU has one set for every country.
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
      password: encryptPassword(this.s.password, this.s.passwordPublicKey),
    });
    if (!login.success || login.data?.tokenName !== "Authorization" || !login.data?.tokenValue) {
      throw new ZeekrError(`login failed ${brief(login)}`);
    }
    // Kept in memory for this login only: the stored session holds just the bearer token.
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
        loginSystem: "Android",
      },
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
      body: { command: "start", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } },
    });
    if (!r.success) throw new ZeekrError(`sentry command rejected ${brief(r)}`);
  }
  // Same command the Home Assistant integration sends to switch Sentry Mode off.
  async stopSentry(vin) {
    const r = await this.app("POST", "ms-remote-control/v1.0/remoteControl/control", {
      vin,
      body: { command: "stop", serviceId: "RSM", setting: { serviceParameters: [{ key: "rsm", value: "6" }] } },
    });
    if (!r.success) throw new ZeekrError(`sentry stop rejected ${brief(r)}`);
  }
}
