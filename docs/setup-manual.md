# Setup with a Cloudflare account only (no GitHub)

For when you don't have a GitHub account: create a Worker in the Cloudflare dashboard, paste the program in, and set a
few things by hand. The result is the same as the one-click setup: it checks your car every 5 minutes.

If you have a GitHub account, the [one-click setup](../README.md#one-click-setup-step-by-step) has fewer steps.

**Before you start,** prepare the second Zeekr account and your places as described in
[Before you start](../README.md#before-you-start-four-things-to-prepare) (you can skip the GitHub account).
**Install it only once:** two copies signing in to the same Zeekr account keep signing each other out.

Cloudflare sometimes rewords its pages, so the labels you see may differ slightly from the ones below.

## Step 1: Create a Worker

Cloudflare dashboard → **Workers & Pages** in the left menu → **Create**.
On the page that offers several ways to start, choose **Start with Hello World!**, name it `zeekr-sentry`, then click
**Deploy**.

Don't choose **Upload your static files**: that is for static websites, and the program would not run.

<!-- Screenshot: docs/images/D1-*.png -->

## Step 2: Paste the program in

When it has deployed, click **Edit code** and delete everything in the editor.
Open https://github.com/dts88/zeekr-shortcut-sentrymode-on/blob/main/dist/zeekr-sentry.js , click **Copy raw file**
(top right of the file), paste it into the editor and click **Deploy**.

Now open the Worker's address (the `...workers.dev` address on the Worker's page). It shows the version and a list of
the settings that are still missing, which means the program is running.

<!-- Screenshot: docs/images/D2-*.png -->

## Step 3: Create the storage space and connect it

- Left menu → **Storage & Databases** → **Workers KV** → **Create instance**. Name it as you like (for example
  `zeekr-sentry-state`) → **Create**. If you can't find the menu, type `KV` into the search box at the top.
- Back in `zeekr-sentry` → **Bindings** → **Add binding** → **KV namespace** → **Add binding**.
- **Variable name must be `STATE`** (capital letters, no spaces). For **KV namespace**, choose the one you just created.
  Click **Add binding** to save.

<!-- Screenshot: docs/images/D3-*.png -->

## Step 4: Schedule it

`zeekr-sentry` → **Settings** → **Trigger Events** → **Add** → **Cron Triggers**.
If there is a frequency choice, pick minutes and enter `5`; if there is only a text box, enter `*/5 * * * *`. Save.
A new schedule can take up to 15 minutes to start.

<!-- Screenshot: docs/images/D4-*.png -->

## Step 5: Add the three settings

`zeekr-sentry` → **Settings** → **Variables and Secrets** → **Add**. Choose the type **Secret** for all three:

| Name | Value |
|---|---|
| `ZEEKR_EMAIL` | the second account's email address |
| `ZEEKR_PASSWORD` | the second account's password |
| `GEOFENCES` | your places, for example `Home, 1.3521, 103.8198, 600` |

<!-- Screenshot: docs/images/D5-*.png -->

## Step 6: Check that it runs

- Reload the Worker's address. It should say `Setup is complete`; anything still missing is listed there.
- Open **Logs**. If it is empty, turn on Workers Logs under **Settings** → **Observability**.
  Filter by event type `scheduled` to see only the scheduled runs. The next run should show `logging in`,
  `logged in (... account, region ...)` and a line about the car.

Anyone can open the Worker's address, but it only shows the version, the credits and the names of the settings, never
your email, password or places. Visits from places you don't recognise in the log are usually automated scanners
and can be ignored.

<!-- Screenshot: docs/images/D6-*.png -->

## After that

Reading the log, changing settings, pausing, uninstalling and the FAQ are the same as for the one-click setup: see
[Everyday use](../README.md#everyday-use) and [FAQ](../README.md#faq). Two differences:

- **Uninstalling:** there is no GitHub repository to delete.
- **Upgrading:** copy the new version of the file from the link in step 2, replace everything in **Edit code** and click
  **Deploy**. Your settings stay as they are.
