// KV-like store kept in one AES-256-GCM encrypted file, for running under Node
// (your PC, GitHub Actions). The key is derived from the Zeekr password, so a copy of
// the file (e.g. the GitHub Actions cache) is useless without the secrets.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function fileStore(path, password, salt) {
  const key = scryptSync(password, `zeekr-sentry:${salt}`, 32);
  let data = {};
  let note = null;
  if (existsSync(path)) {
    try {
      const raw = Buffer.from(readFileSync(path, "utf8"), "base64");
      const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(raw.length - 16));
      data = JSON.parse(Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]).toString("utf8"));
    } catch {
      note = "saved state could not be read (password changed?), starting fresh";
    }
  }
  const save = () => {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
    writeFileSync(path, Buffer.concat([iv, body, c.getAuthTag()]).toString("base64"));
  };
  return {
    note,
    async get(k, opts) {
      const v = data[k];
      if (v === undefined) return null;
      return (typeof opts === "string" ? opts : opts?.type) === "json" ? JSON.parse(v) : v;
    },
    async put(k, v) {
      data[k] = String(v);
      save();
    },
    async delete(k) {
      delete data[k];
      save();
    },
  };
}
