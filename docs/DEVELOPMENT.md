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
| `GEOFENCES` | up to 10 places, separated by `;` or new lines, each `name, latitude, longitude, radius in metres` (radius optional, default 600). Full-width input from a Chinese or Japanese keyboard (`，；．－`, digits, `、。`) is read as ASCII. Required; `none` for no places |
| `DRY_RUN` | optional, `true` = log the decision, never send the command |
| `HMAC_ACCESS_KEY`, `HMAC_SECRET_KEY`, `PASSWORD_PUBLIC_KEY`, `PROD_SECRET`, `VIN_KEY`, `VIN_IV` | optional, override the app constants in `src/app-constants.js` (EM). A European account needs all six from the European app |

After the first deploy of an imported fork, the user adds the three settings of `.dev.vars.example` as secrets in
the Worker's settings (see README).

## Regions

Zeekr's overseas servers come in two families, each with its own app keys (`src/zeekr.js` → `FAMILIES`):
**EM** (Southeast Asia, Middle East, Latin America; one user directory, and a region list naming each country's
servers) and **EU** (Europe; one set of servers). At login the program asks each family in turn: a gateway that
refuses the keys answers `0001` "Invalid access key" and is skipped, and the first user directory that knows the
email decides the region, its login server and its `X-PROJECT-ID` (`ZEEKR_LA`, `ZEEKR_EU`, else `ZEEKR_SEA`, as
zeekr_ev_api and openzeekr send it). The built-in keys are EM's; no public project ships the European ones, so a
European user extracts their own (wysie/zeekr_key_extractor `--region EU`; `PROD_SECRET`, `VIN_KEY` and `VIN_IV`
only at runtime from the European app 3.x, see borconi/openzeekr). Only Singapore (SEA) is tested on a real car;
the European path follows zeekr_ev_api and openzeekr, whose author verified it on a European car.

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

Users install by forking the public repository and importing the fork in Cloudflare (Workers Builds), and
upgrade with GitHub's **Sync fork**, which redeploys the Worker with its settings and KV namespace. The Worker's
name is the repository's (`wrangler.jsonc`), because Cloudflare names an imported fork's Worker after it and only
builds when the two match. Once a day (the tick just after 00:00 UTC) the Worker reads `version` from the public
repository's `package.json` on `main` and logs `version … is available` when it is newer, so `main` there is
the release.
