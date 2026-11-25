import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Store } from "./store.js";

export const adminConfig = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  salt: z.string().regex(/^[0-9a-f]{32}$/),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
});
const hostId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const issue = () => randomBytes(32).toString("hex");
export function management(
  app: express.Express,
  path: string,
  origin: string,
  admin: z.infer<typeof adminConfig>,
  legacy: string[],
  store: Store,
) {
  if (
    !/^https:\/\/[a-zA-Z0-9.[\]:-]+$/.test(origin) ||
    new URL(origin).origin !== origin
  )
    throw Error("Management needs a canonical HTTPS origin");
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS probes(host TEXT PRIMARY KEY,invite TEXT UNIQUE,expires INTEGER NOT NULL,device TEXT UNIQUE);
           CREATE TABLE IF NOT EXISTS admin_key(owner TEXT PRIMARY KEY,digest TEXT UNIQUE);`);
  function ids() {
    return [
      ...legacy,
      ...db
        .prepare("SELECT host FROM probes WHERE device IS NOT NULL")
        .all()
        .map((r) => String(r.host)),
    ];
  }
  const folder = fileURLToPath(new URL("../downloads/", import.meta.url));
  const sessions = new Map<string, number>();
  // A single pilot administrator uses one active login. Bound failed attempts before doing password work.
  let failures = 0,
    reset = 0;
  app.use("/admin", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    res.set("Referrer-Policy", "no-referrer");
    next();
  });
  app.get("/admin", (_req, res) =>
    res.sendFile(fileURLToPath(new URL("../src/admin.html", import.meta.url))),
  );
  app.use("/admin/api", express.json({ limit: "4kb" }));
  app.post("/admin/api/login", (req, res) => {
    const now = Date.now();
    if (now >= reset) {
      failures = 0;
      reset = now + 60_000;
    }
    if (failures >= 10) {
      res.sendStatus(429);
      return;
    }
    const creds = z
      .object({ id: z.string(), password: z.string().max(512) })
      .parse(req.body);
    if (
      !timingSafeEqual(
        scryptSync(creds.password, admin.salt, 32),
        Buffer.from(admin.hash, "hex"),
      ) ||
      creds.id !== admin.id
    ) {
      failures++;
      res.sendStatus(401);
      return;
    }
    const token = issue();
    sessions.clear();
    sessions.set(hash(token), now + 8 * 3600_000);
    failures = 0;
    res.cookie("newids_session", token, {
      secure: true,
      httpOnly: true,
      sameSite: "strict",
      path: "/admin",
      maxAge: 8 * 3600_000,
    });
    res.json({ ok: true });
  });
  app.use("/admin/api", (req, res, next) => {
    const token = req.headers.cookie?.match(
      /(?:^|;\s*)newids_session=([a-f0-9]{64})(?:;|$)/,
    )?.[1];
    if (!token || (sessions.get(hash(token)) ?? 0) <= Date.now()) {
      res.sendStatus(401);
      return;
    }
    next();
  });
  app.post("/admin/api/logout", (_req, res) => {
    sessions.clear();
    res.clearCookie("newids_session", { path: "/admin" });
    res.json({ ok: true });
  });
  app.get("/admin/api/status", (_req, res) =>
    res.json({
      hosts: store.hosts(ids()),
      pending: db
        .prepare(
          "SELECT host,expires FROM probes WHERE device IS NULL AND expires>?",
        )
        .all(Date.now()),
      mcp: origin + "/mcp",
      key_active: !!db
        .prepare("SELECT 1 FROM admin_key WHERE owner=?")
        .get(admin.id),
    }),
  );
  app.post("/admin/api/key", (_req, res) => {
    const token = issue();
    db.prepare(
      "INSERT INTO admin_key VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET digest=excluded.digest",
    ).run(admin.id, hash(token));
    res.json({ key: token });
  });
  app.post("/admin/api/pair", (req, res) => {
    const host = hostId.parse(req.body.host);
    const token = issue();
    const expires = Date.now() + 10 * 60_000;
    if (
      legacy.includes(host) ||
      !db
        .prepare(
          "INSERT INTO probes(host,invite,expires) VALUES(?,?,?) ON CONFLICT(host) DO UPDATE SET invite=excluded.invite,expires=excluded.expires WHERE device IS NULL",
        )
        .run(host, hash(token), expires).changes
    ) {
      res.status(409).json({ error: "主机名已注册" });
      return;
    }
    res.json({
      expires,
      command: `(set -e; f=$(mktemp); trap 'rm -f "$f"' EXIT; curl -fsS '${origin}/downloads/install-client.sh' -o "$f"; sudo bash "$f" '${origin}' '${host}' '${token}')`,
    });
  });
  for (const asset of [
    "install-client.sh",
    "client.tar.gz",
    "client.tar.gz.sha256",
  ])
    app.get("/downloads/" + asset, (_req, res) =>
      res.sendFile(asset, { root: folder }),
    );
  app.post("/v1/pair", express.json({ limit: "4kb" }), (req, res) => {
    const q = z
      .object({
        host: hostId,
        invite: z.string().regex(/^[a-f0-9]{64}$/),
        device: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(req.body);
    const ok = db
      .prepare(
        "UPDATE probes SET invite=NULL,device=? WHERE host=? AND invite=? AND expires>? AND device IS NULL",
      )
      .run(hash(q.device), q.host, hash(q.invite), Date.now()).changes;
    res.sendStatus(ok ? 204 : 403);
  });
  return {
    device: (token: string) => {
      const r = db
        .prepare("SELECT host FROM probes WHERE device=?")
        .get(hash(token));
      return r ? { id: String(r.host) } : undefined;
    },
    user: (token: string) =>
      db
        .prepare("SELECT 1 FROM admin_key WHERE owner=? AND digest=?")
        .get(admin.id, hash(token))
        ? { id: admin.id, hosts: ids() }
        : undefined,
  };
}
