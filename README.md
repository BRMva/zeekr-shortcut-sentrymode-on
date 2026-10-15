# zeekr-shortcut-sentrymode-on

Checks your Zeekr every 5 minutes and turns **sentry mode** on when the car is parked and locked
outside your geofences (home, office, ...). It runs in your own free **Cloudflare** account: no server,
no code to edit, set up in the browser. 中文安装指南：[docs/setup-zh.md](docs/setup-zh.md)

Unofficial. Uses the Zeekr overseas app API as reverse-engineered by
[Fryyyyy/zeekr_ev_api](https://github.com/Fryyyyy/zeekr_ev_api); it can stop working whenever Zeekr changes it.

## What it does

Each tick, for every car on the account:

- Driving → nothing; the next stop is a new parking.
- Parked inside a geofence → nothing.
- Parked outside, locked, battery at least 20%, sentry off → turn sentry on (up to 3 tries per parking).
- Sentry was on during this parking and is now off → leave it off (you or the car turned it off).

It never turns sentry off.

## Settings

| Name | What |
|---|---|
| `ZEEKR_EMAIL` | a **second** Zeekr account the car is shared with — not the one on your phone, which would get signed out |
| `ZEEKR_PASSWORD` | its password |
| `GEOFENCES` | up to 10 places, separated by `;`, each `name, latitude, longitude, radius in metres` (radius optional, default 600), e.g. `Home, 1.3521, 103.8198, 600; Office, 1.2840, 103.8510, 600`. Required: write `none` for no places |

Latitude and longitude: right-click the spot in Google Maps and click the numbers to copy them.
The account's country is read from Zeekr at login. Accounts from the SEA, UAE and Latin America regions work; Europe does not.

## Set up

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on)

Click the button, sign in to Cloudflare and GitHub (or sign up, both free), fill in the three settings, deploy.
Cloudflare copies this code into your GitHub and creates the schedule and the storage it needs.

Logs: Cloudflare dashboard → Workers & Pages → `zeekr-sentry` → Logs. Settings: same Worker → Settings → Variables and Secrets.

**No GitHub account?** Create a Worker in the Cloudflare dashboard ("Start with Hello World!", not "Upload your static files"), paste all of
[`dist/zeekr-sentry.js`](dist/zeekr-sentry.js) into its code editor, then bind a KV namespace as `STATE`,
add a cron trigger every 5 minutes and add the three settings as secrets. Step by step: [docs/setup-zh.md](docs/setup-zh.md).
Install only once per Zeekr account: two copies logging in to the same account keep signing each other out.

A log line looks like `[v0.3.0] car …ABC123 engine=engine-off locked=true battery=76% sentry=off 1840 m from "Home" -> enable: attempt 1/3`.
Every line starts with the version; each login also logs the name, version and source. A Worker made in the dashboard
answers on its own URL with the version, the credits and whether its setup is complete (setting names only).

## For developers

One core, two entry points: `src/run.js` (one tick) is used by `src/index.js` (Cloudflare cron, state in KV)
and `scripts/run.mjs` (Node: one tick on your PC, or by hand on GitHub Actions with `.github/workflows/sentry.yml`,
state in an encrypted file). The Zeekr app constants are in `src/app-constants.js`.

`dist/zeekr-sentry.js` is the same code bundled into one file for the dashboard; it uses Web APIs only, so neither
way of installing needs compatibility flags. Rebuild it after changing `src/` (`npm test` fails while it is stale).

```bash
npm install
cp .dev.vars.example .dev.vars    # fill in the settings
npm run check                     # one dry run from your PC
npm run build                     # regenerate dist/zeekr-sentry.js
npm test
```

## Credits

Request signing, endpoints and the sentry command are ported from
[Fryyyyy/zeekr_ev_api](https://github.com/Fryyyyy/zeekr_ev_api) and
[Fryyyyy/zeekr_homeassistant](https://github.com/Fryyyyy/zeekr_homeassistant) (both MIT).
The app constants in `src/app-constants.js` come from the public Zeekr app, extracted with
[wysie/zeekr_key_extractor](https://github.com/wysie/zeekr_key_extractor) (MIT).
`test/vectors.json` was generated with zeekr_ev_api 0.1.15 and dummy keys; `npm test` checks the port against it.
