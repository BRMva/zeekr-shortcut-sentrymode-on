# Setup with a Cloudflare account only (no GitHub)

For when you don't have a GitHub account: create a Worker in the Cloudflare dashboard, paste the program in, and set a
few things by hand. The result is the same as the one-click setup: it checks your car every 5 minutes.

If you have a GitHub account, the [one-click setup](../README.md#one-click-setup-step-by-step) has fewer steps.

**Before you start,** prepare the second Zeekr account and your places as described in
[Before you start](../README.md#before-you-start-four-things-to-prepare) (you can skip the GitHub account).
**Install it only once:** two copies signing in to the same Zeekr account keep signing each other out.

Cloudflare sometimes rewords its pages, so what you see may differ slightly from the pictures below.

## Step 1: Create a Worker

In the Cloudflare dashboard, open **Compute** → **Workers & Pages** and click **Create application**.

![Workers & Pages, then Create application](images/create-application.jpg)

On the next page choose **Start with Hello World!**, name the Worker `zeekr-sentry`, then click **Deploy**.
Don't choose **Upload your static files**: that is for static websites, and the program would not run.

## Step 2: Paste the program in

1. On the Worker's page, click **Edit code** (top right). Delete everything in the editor.

   ![Edit code, top right of the Worker's page](images/worker-edit-code.jpg)

2. Open https://github.com/dts88/zeekr-shortcut-sentrymode-on/blob/main/dist/zeekr-sentry.js and click the
   **Copy raw file** button next to **Raw**. This copies the whole program.

   ![Copy raw file, next to Raw](images/copy-raw-file.jpg)

3. Paste it into the editor and click **Deploy**.

Now open the Worker's address (the `...workers.dev` address on the Worker's page). It shows the version and a list of
the settings that are still missing, which means the program is running.

## Step 3: Create the storage space and connect it

1. In the left menu, open **Storage & databases** → **Workers KV** and click **Create a KV namespace**. Name it as you
   like, for example `zeekr-sentry-state`, and create it.

   ![Workers KV, then Create a KV namespace](images/kv-list.jpg)

2. Back on the Worker's page, open **Settings**. Under **Bindings**, click **Add binding** and choose
   **KV namespace**.
3. **Variable name must be `STATE`** (capital letters, no spaces). For the KV namespace, choose the one you just
   created. Add the binding.

   ![Settings: Add binding (2) and Add variable (3)](images/settings-add.jpg)

## Step 4: Schedule it

On the Worker's **Settings** page, under **Trigger events** → **Cron triggers**, click **+ Add**. On the **Schedule**
tab, set *Execute Worker every* to **Minute(s)** and change the number to **5** (it starts at 30), then click **Add**.
A new schedule can take up to 15 minutes to start.

![Execute Worker every 5 Minute(s), then Add](images/cron-add.jpg)

## Step 5: Add the three settings

On the Worker's **Settings** page, under **Runtime variables and secrets**, click **Add variable** (3 in the Step 3
picture). Add these three, each with the type **Secret**, then click **Deploy**:

| Name | Value |
|---|---|
| `ZEEKR_EMAIL` | the second account's email address |
| `ZEEKR_PASSWORD` | the second account's password |
| `GEOFENCES` | your places, for example `Home, 1.3521, 103.8198, 600` |

## Step 6: Check that it runs

- Reload the Worker's address. It should say `Setup is complete`; anything still missing is listed there.
- Open the Worker's **Observability** tab. After the next scheduled run you should see `logging in`,
  `logged in (... account, region ...)` and a line about the car. If nothing ever appears, check that **Logs** is
  switched on under **Settings** → **Observability**.

  ![The Observability tab](images/logs.jpg)

Anyone can open the Worker's address, but it only shows the version, the credits and the names of the settings, never
your email, password or places. Visits from places you don't recognise in the log are usually automated scanners
and can be ignored.

## After that

Reading the log, changing settings, pausing, uninstalling and the FAQ are the same as for the one-click setup: see
[Everyday use](../README.md#everyday-use) and [FAQ](../README.md#faq). Two differences:

- **Uninstalling:** there is no GitHub repository to delete.
- **Upgrading:** copy the new version of the file as in step 2, replace everything in **Edit code** and click
  **Deploy**. Your settings stay as they are.
