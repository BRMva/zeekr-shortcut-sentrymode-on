# Zeekr Sentry Mode Auto-On

When you park and lock your Zeekr anywhere other than the places you choose (home, office, ...), this program turns
sentry mode on for you within a few minutes.

- **Free:** it runs in your own Cloudflare account, on the free plan.
- **Nothing to keep running:** it runs on Cloudflare's servers, so your computer and phone can be off.
- **No code:** you set it up in your browser by clicking and filling in a form. It takes about 15 minutes.

**How it works**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/overview-dark.svg">
  <img alt="The program runs in your own Cloudflare account, keeps your settings there encrypted, and talks to Zeekr's servers over an encrypted connection; the servers pass the sentry command to your car." src="docs/images/overview-light.svg">
</picture>

The program runs in **your own** Cloudflare account. Your second Zeekr account's email and password, and your places,
are stored there encrypted. Every 5 minutes it signs in to Zeekr's servers over an encrypted (HTTPS) connection, the
same way the Zeekr app does, reads where the car is, whether it is locked and its battery level, and asks for sentry
mode when needed; Zeekr's servers pass that on to the car. There is no server of the author's in between, and nobody
else can see your settings.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on)

> This is an unofficial, personal project, not affiliated with Zeekr. It works through the same service the Zeekr app
> uses, so it may stop working for a while if Zeekr changes that service.
> Tested with a Singapore account. Accounts from Zeekr's Southeast Asia, Middle East and Latin America regions should
> work; European accounts are not supported.

**Contents**

1. [What it does](#what-it-does)
2. [Before you start: four things to prepare](#before-you-start-four-things-to-prepare)
3. [One-click setup, step by step](#one-click-setup-step-by-step)
4. [Check that it works](#check-that-it-works)
5. [Everyday use](#everyday-use): logs, changing settings, pausing, uninstalling, upgrading
6. [FAQ](#faq)
7. [Privacy and security](#privacy-and-security)

---

## What it does

Every 5 minutes the program checks your car:

| Your car is ... | The program ... |
|---|---|
| being driven | does nothing |
| parked within one of your places (for example at home) | does nothing |
| parked elsewhere, locked, battery at least 20%, sentry mode off | **turns sentry mode on**, trying up to 3 times per parking |
| parked, and sentry mode was on during this parking but has been turned off (by you or by the car) | leaves it off |

It never turns sentry mode off.

---

## Before you start: four things to prepare

### 1. A second Zeekr account that your car is shared with

The program has to sign in to a Zeekr account to check the car and turn sentry mode on. **Use a second account, not the
one in your phone's Zeekr app:** when an account signs in somewhere else, the app is signed out.

1. Register a new Zeekr account with a different email address.
2. In the Zeekr app, signed in with your **main** account, open **Vehicle & Security** → **Share Vehicle** (1) →
   **Create Sharing** (2), and share the car with the second account's email address, for an unlimited time.
   <!-- To confirm: where Vehicle & Security is opened from; the fields of the Create Sharing form -->
3. Sign in to the Zeekr app with the **second** account and accept the shared car. Back in the main account, the
   sharing list now shows **Accepted**, **Started** and **Unlimited time** (3).
   <!-- To confirm: how the second account accepts the invitation -->
4. While signed in with the second account, check that you can see the car and its sentry mode switch, then sign out.
   Don't use the second account in the app after that.

<p>
  <img alt="Vehicle &amp; Security, then Share Vehicle" src="docs/images/zeekr-app-vehicle-security.jpg" width="300">
  &nbsp;
  <img alt="Share Vehicle: Create Sharing; the sharing list shows Accepted, Started, Unlimited time" src="docs/images/zeekr-app-share-vehicle.jpg" width="300">
</p>

### 2. The places where sentry mode should not turn on (up to 10)

Near these places the program never turns sentry mode on: home, office, and so on.

1. On a computer, open [Google Maps](https://www.google.com/maps), find the place and **right-click** it.
2. The first line of the menu is two numbers (latitude, longitude). Click it to copy them.

   ![Google Maps: right-click a place, the first line is its latitude and longitude](docs/images/google-maps-coordinates.jpg)

3. Write each place as `name, latitude, longitude, radius`, with the radius in metres. Separate places with a semicolon:

```
Home, 1.3521, 103.8198, 600; Office, 1.2840, 103.8510, 600
```

- **The name** only appears in the program's log, so you can tell the places apart.
- **The radius** can be left out; it is then 600 metres. In underground car parks the car's reported position often
  drifts by a few hundred metres, and a radius that is too small makes "at home" look like "away". If there is a place
  nearby where you do want sentry mode (a shopping mall car park, say), make the radius smaller.
- Commas and semicolons typed with a Chinese or Japanese keyboard (`，` `；`) are fine too.
- At least one place is required. If you really want none, write `none`.

### 3. A Cloudflare account (free)

Go to https://dash.cloudflare.com/sign-up , sign up with an email address and a password, then click the link in the
verification email. New accounts are on the free plan; no credit card is needed.

### 4. A GitHub account (free)

Go to https://github.com/signup and sign up. During setup, Cloudflare puts a copy of this program into your GitHub
account and deploys it from there.

---

## One-click setup, step by step

Use a computer. It takes about 10 minutes. Cloudflare sometimes rewords its pages, so what you see may differ
slightly from the pictures below.

### Step 1: Click the deploy button

Click **Deploy to Cloudflare** at the top of this page, or open:
https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on

If you are not signed in to Cloudflare yet, you are asked to sign in first and then brought to a page called
**Set up your application**.

### Step 2: Connect GitHub and name the project

![The top of "Set up your application": Git account, Create private Git repository, Project name](docs/images/deploy-1.jpg)

1. **Git account:** open the list and choose **New GitHub connection**. GitHub opens and asks you to let Cloudflare
   use your account; allow it, and you come back to this page with your GitHub account selected. (If your GitHub account
   is already listed under *Connected accounts*, just choose it.)

   ![The Git account list: choose New GitHub connection](docs/images/deploy-github.jpg)

   <!-- To confirm: the options on GitHub's authorization page (All repositories / Only select repositories) -->

2. **Create private Git repository:** tick it. Cloudflare puts the copy of the program in your GitHub as a private
   repository and deploys from it.
3. **Project name:** keep `zeekr-sentry`.

Below that, **Select KV namespace** shows **+ Create new** and a name for it. Keep both: this creates the storage the
program uses for its sign-in session and the current parking.

### Step 3: Fill in the three settings

![ZEEKR_EMAIL, ZEEKR_PASSWORD and GEOFENCES](docs/images/deploy-2.jpg)

4. **ZEEKR_EMAIL:** the second Zeekr account's email address.
5. **ZEEKR_PASSWORD:** that account's password.
6. **GEOFENCES:** the places you prepared, for example `Home, 1.3521, 103.8198, 600`.

Leave **Build command**, **Deploy command** and **Preview command** as they are.

### Step 4: Deploy

![Switch off Enable Preview builds, then click Deploy](docs/images/deploy-3.jpg)

7. Switch **Enable Preview builds** off. It is only for people who change the program.
8. Leave **Protect with Cloudflare Access** off and **Advanced settings** as they are, then click **Deploy**.

Wait 1–3 minutes until the page says the deployment has succeeded.
<!-- To confirm with a real run: the progress and success pages -->

Cloudflare has now:
- put a private copy of the program in your GitHub,
- created the storage space,
- scheduled the program to run every 5 minutes,
- stored the three settings, encrypted.

---

## Check that it works

### Read the log

1. In the Cloudflare dashboard, open **Compute** → **Workers & Pages** in the left menu and click `zeekr-sentry`.

   ![Workers & Pages, then zeekr-sentry](docs/images/workers-list.jpg)

2. Open the **Observability** tab. Each run adds a few lines. Lines starting with `[v…]` come from the program;
   lines showing `*/5 * * * *` only mark that a scheduled run happened.

   ![The Observability tab: the program's lines start with the version](docs/images/logs.jpg)

A new schedule can take up to 15 minutes to start. The first run looks like this (`[v0.3.2]` is the program's version):

```
[v0.3.2] logging in · zeekr-sentry 0.3.2 · https://github.com/dts88/zeekr-shortcut-sentrymode-on · based on Fryyyyy/zeekr_ev_api (MIT)
[v0.3.2] logged in (SG account, region SEA), 1 car(s)
[v0.3.2] car …123456 engine=engine-off locked=true battery=80% sentry=off 120 m from "Home" -> none: inside geofence "Home"
```

The last line is the result of each check:

| Part | Meaning |
|---|---|
| `car …123456` | the last 6 characters of the car's VIN |
| `engine=engine-off` | the car is switched off (`engine-running` means it is being driven) |
| `locked=true` | the car is locked |
| `battery=80%` | battery level |
| `sentry=off` | sentry mode is currently off |
| `120 m from "Home"` | distance to the nearest of your places |
| `-> none: inside geofence "Home"` | what the program decided, and why: within Home, so nothing to do |

### Try it in the car

Park somewhere outside your places and lock the car. Within 10 minutes, open the Zeekr app: sentry mode should be on.
The log shows:

```
[v0.3.2] car …123456 engine=engine-off locked=true battery=80% sentry=off 2400 m from "Home" -> enable: attempt 1/3
[v0.3.2] car …123456 sentry start sent
```

---

## Everyday use

### Read the log

Cloudflare dashboard → **Compute** → **Workers & Pages** → `zeekr-sentry` → **Observability**.

### Change your places or password

1. Cloudflare dashboard → **Compute** → **Workers & Pages** → `zeekr-sentry` → **Settings**.
2. Under **Runtime variables and secrets**, click the edit (pencil) button next to the setting, for example `GEOFENCES`.

   ![Settings, then the pencil next to the setting](docs/images/settings-secrets.jpg)

3. Saved secrets cannot be viewed again: click **Rotate**, type the whole new value (not just the part you are
   changing), then click **Deploy**. (**Save version** alone does not put the change into use.)

   ![Rotate, type the new value, Deploy](docs/images/secret-rotate.jpg)

### Pause and resume

On the Worker's **Settings** page, under **Trigger events**:

![Trigger events: the bin pauses, Add resumes; Delete removes the whole Worker](docs/images/trigger-events.jpg)

- **Pause:** delete the cron trigger that runs every 5 minutes (the bin icon, 1).
- **Resume:** click **+ Add** (2). On the **Schedule** tab, set *Execute Worker every* to **Minute(s)** and change the
  number to **5** (it starts at 30), then click **Add**.

  ![Execute Worker every 5 Minute(s), then Add](docs/images/cron-add.jpg)

### Uninstall

1. On the Worker's **Settings** page, under **Danger zone**, click **Delete** next to *Delete Worker* (3 in the picture
   above).
2. Cloudflare dashboard → **Storage & databases** → **Workers KV**: delete the storage space created during setup
   (`zeekr-sentry`, or a name starting with it) from the **⋯** menu on its row.

   ![Workers KV: the storage space created during setup](docs/images/kv-list.jpg)

3. On GitHub, delete the repository created during setup (repository page → **Settings** → **Delete this repository**
   at the bottom).
4. In the Zeekr app, stop sharing the car with the second account.

### Upgrade to a new version

New versions are published on this page. The `[v…]` at the start of each log line is the version you are running.

To upgrade, uninstall the old one (steps 1–3 above), then do the one-click setup again. You will need to enter the three
settings again.

---

## FAQ

**Does it cost anything?**
No. Cloudflare's free plan allows 100,000 requests a day; this program runs about 300 times a day.

**My phone's Zeekr app keeps getting signed out.**
`ZEEKR_EMAIL` is your main account. Change it to the second account's email and password (see
[Change your places or password](#change-your-places-or-password)).

**Sentry mode was turned on while the car was at home.**
Look at `… m from "Home"` in that log line. If the distance is larger than your radius, either the coordinates are off,
the radius is too small (underground car parks drift), or `GEOFENCES` is not written correctly.

**I parked away from home and sentry mode did not turn on.**
Look at the reason after `-> none:` in the log:

| Reason in the log | Meaning |
|---|---|
| `inside geofence "…"` | the car is within one of your places |
| `not locked yet` | the car is not locked yet; it tries again at the next check |
| `battery 15% below 20%` | battery is below 20%, so sentry mode stays off to protect it |
| `sentry turned off during this parking, respecting it` | sentry mode was on during this parking and was turned off, so it stays off |
| `gave up after 3 attempts` | 3 tries during this parking did not turn it on; the count starts again at the next parking |
| `not parked (engine-running)` | the car is being driven |

**Other log messages**

| Message | Meaning |
|---|---|
| `signed out: the account logged in elsewhere …, logging in again` | the second account was used somewhere else (the Zeekr app, or another copy of this program), so the program signs in again. If this happens often, check that nothing else uses the second account |
| `token expired, logging in again` | the sign-in expired and the program signs in again. Occasional ones are normal |
| `missing: …` | a setting is missing; add it under **Runtime variables and secrets** |
| `geofence 2 should look like …` | the 2nd place is not written correctly |
| `no Zeekr account with this email …` | the email is wrong, or it is a European account (not supported) |
| `login needed but held back …` | the program signed in less than 30 minutes ago and waits before signing in again, so the account is not locked. If it keeps appearing, check the password |

**I have two cars.**
Share both with the second account; the program checks each one.

---

## Privacy and security

- **Your Zeekr email and password** are stored as encrypted secrets in **your own** Cloudflare account. Nobody else,
  including the author, can see them.
- **The copy in your GitHub** contains only the program, none of your settings.
- **The log** shows how far the car is from your places, its battery level and so on. Keep that in mind before
  sharing screenshots of it.
- Give the second Zeekr account a password you don't use anywhere else.

---

## No GitHub account?

You can also set it up with only a Cloudflare account: create a Worker in the dashboard, paste in one file and set a
few things by hand. See [docs/setup-manual.md](docs/setup-manual.md).

---

## Credits and license

MIT license, by [dts88](https://github.com/dts88). Based on:

- [Fryyyyy/zeekr_ev_api](https://github.com/Fryyyyy/zeekr_ev_api) (MIT): the Zeekr service, sign-in and request signing
- [Fryyyyy/zeekr_homeassistant](https://github.com/Fryyyyy/zeekr_homeassistant) (MIT): the sentry command and status fields
- [wysie/zeekr_key_extractor](https://github.com/wysie/zeekr_key_extractor) (MIT): constants from the public Zeekr app

For developers: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
