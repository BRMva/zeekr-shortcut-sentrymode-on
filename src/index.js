// Cloudflare Worker entry: one tick per cron trigger. State lives in the STATE KV namespace.

import { TAG, aboutText } from "./about.js";
import { run, setupProblems } from "./run.js";
import { parseGeofences } from "./sentry.js";

export default {
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
    const setup = problems.length
      ? ["Setup is not complete:", ...problems.map((p) => `  ${p}`)]
      : [`Setup is complete (geofences: ${parseGeofences(env.GEOFENCES).length}). It runs on its cron trigger; see the Worker's Logs.`];
    return new Response([aboutText(), "", ...setup, ""].join("\n"), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
