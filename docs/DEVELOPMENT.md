# Development

## Layout

One core, two entry points:

- `src/run.js` — one tick: log in if needed, read each car, decide (`src/sentry.js`), send the sentry command.
- `src/index.js` — Cloudflare Worker: cron trigger → `run()`, state in the `STATE` KV namespace; its URL (when it has
  one) shows the version, credits and which settings are missing.
- `scripts/run.mjs` — Node: one tick on your PC (`npm run check`), or by hand on GitHub Actions
  (`.github/workflows/sentry.yml`, maintainer's test tool, no schedule). State in an encrypted file.

`src/zeekr.js` and `src/crypto.js` are a port of [Fryyyyy/zeekr_ev_api](https://github.com/Fryyyyy/zeekr_ev_api);
`test/vectors.json` (generated with zeekr_ev_api 0.1.15 and dummy keys) checks the signatures byte for byte.
The Zeekr app constants are in `src/app-constants.js`; the account's country is read from Zeekr at login.
The code uses Web APIs only (MD5 is built in, `src/md5.js`), so no compatibility flags are needed.

`dist/zeekr-sentry.js` is `src/` bundled into one file for the paste-into-the-dashboard setup. Rebuild it after
changing `src/` (`npm run build`); `npm test` fails while it is stale.

## Settings

| Name | What |
|---|---|
| `ZEEKR_EMAIL` | a second Zeekr account the car is shared with |
| `ZEEKR_PASSWORD` | its password |
| `GEOFENCES` | up to 10 places, separated by `;` or new lines, each `name, latitude, longitude, radius in metres` (radius optional, default 600). Required; `none` for no places |
| `DRY_RUN` | optional, `true` = log the decision, never send the command |

The Deploy to Cloudflare page asks for the entries in `.dev.vars.example`, with the descriptions in
`package.json` → `cloudflare.bindings`.

## Commands

```bash
npm install
cp .dev.vars.example .dev.vars    # fill in the settings
npm run check                     # one dry run from your PC
npm run build                     # regenerate dist/zeekr-sentry.js
npm test
```

## Versions and releases

`src/about.js` holds the name, version, source and credits; every log line starts with `[v<version>]`.
Bump `src/about.js` and `package.json` together for every change that ships (a test checks they match).

Development happens in a private repository whose `main` deploys the maintainer's own Worker (Workers Builds),
so every change is tried on a real car first. Releases are the same files copied to the public repository.
