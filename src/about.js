// Name, version, source and credits: shown in every log line (version), in the log at each
// login, on the Worker's own URL, and at the top of dist/zeekr-sentry.js. The version must
// match package.json (a test checks it); bump both for every change that ships.
export const ABOUT = {
  name: "zeekr-sentry",
  version: "0.3.0",
  author: "dts88",
  repo: "https://github.com/dts88/zeekr-shortcut-sentrymode-on",
  license: "MIT",
  credits: [
    "Fryyyyy/zeekr_ev_api (MIT): Zeekr API, login and request signing",
    "Fryyyyy/zeekr_homeassistant (MIT): sentry command and status fields",
    "wysie/zeekr_key_extractor (MIT): app constants from the public Zeekr app",
  ],
};

export const TAG = `[v${ABOUT.version}]`;

export function aboutText() {
  return [
    `${ABOUT.name} ${ABOUT.version}`,
    "Turns Zeekr sentry mode on when the car is parked and locked away from your geofences.",
    `Source: ${ABOUT.repo} (${ABOUT.license}) by ${ABOUT.author}`,
    "Based on:",
    ...ABOUT.credits.map((c) => `  ${c}`),
  ].join("\n");
}
