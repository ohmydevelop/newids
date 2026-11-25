import express from "express";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  Store,
  alert,
  command,
  health,
  label,
  policy,
  result,
} from "./store.js";

import { adminConfig, management } from "./management.js";

process.umask(0o077);
const secret = z.string().min(32);
const config = z
  .object({
    listen: z.string().default("127.0.0.1"),
    port: z.number().int().min(1).max(65535),
    database: z.string(),
    tls: z.object({ cert: z.string(), key: z.string() }).optional(),
    origin: z.url().optional(),
    admin: adminConfig.optional(),
    hosts: z.array(z.object({ id: label, token: secret })),
    users: z.array(
      z.object({ id: label, token: secret, hosts: z.array(label) }),
    ),
  })
  .parse(
    JSON.parse(
      readFileSync(process.argv[2] ?? "/etc/newids/server.json", "utf8"),
    ),
  );
const principals = [...config.hosts, ...config.users];
if (
  new Set(principals.map((p) => p.token)).size !== principals.length ||
  [config.users, config.hosts].some(
    (group) => new Set(group.map((p) => p.id)).size !== group.length,
  ) ||
  config.users.some((u) =>
    u.hosts.some((h) => !config.hosts.some((device) => device.id === h)),
  )
)
  throw Error("Invalid credential or host configuration");
if (!config.tls && !["localhost", "127.0.0.1", "::1"].includes(config.listen))
  throw Error("Remote listener requires TLS");
const db = new Store(config.database);
const app = express();
app.disable("x-powered-by");
function authenticated<T extends { token: string }>(
  req: express.Request,
  records: T[],
) {
  const auth = req.header("authorization");
  if (!auth?.startsWith("Bearer ")) return;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const candidate = digest(auth.slice(7));
  return records.find((r) => timingSafeEqual(digest(r.token), candidate));
}
app.use((req, res, next) => {
  if (req.headers.origin && req.headers.origin !== config.origin) {
    res.sendStatus(403);
    return;
  }
  next();
});
if (
  config.admin &&
  (config.users.some((u) => u.id === config.admin?.id) ||
    !config.tls ||
    !config.origin)
)
  throw Error("Administrator requires TLS, origin and a unique identity");
const consoleAuth =
  config.admin && config.origin
    ? management(
        app,
        config.database,
        config.origin,
        config.admin,
        config.hosts.map((h) => h.id),
        db,
      )
    : undefined;
function bearer(req: express.Request) {
  return req.header("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
}
app.get("/v1/identity", (req, res) => {
  const token = bearer(req);
  const device = token && consoleAuth?.device(token);
  if (!device) {
    res.sendStatus(401);
    return;
  }
  res.json({ host: device.id });
});
app.post(
  "/v1/device/:op",
  (req, res, next) => {
    const token = bearer(req);
    const device =
      authenticated(req, config.hosts) ?? (token && consoleAuth?.device(token));
    if (!device) {
      res.sendStatus(401);
      return;
    }
    res.locals.host = device.id;
    next();
  },
  express.json({ limit: "8mb" }),
  (req, res) => {
    const host = label.parse(res.locals.host);
    switch (req.params.op) {
      case "heartbeat":
        db.heartbeat(host, policy.parse(req.body));
        break;
      case "health":
        db.detector(host, health.parse(req.body));
        break;
      case "alert":
        db.ingest(host, alert.parse(req.body));
        break;
      case "claim":
        res.json({ job: db.claim(host) });
        return;
      case "finish": {
        const body = z.object({ id: z.uuid(), result }).parse(req.body);
        if (!db.finish(host, body.id, body.result)) {
          res.sendStatus(409);
          return;
        }
        break;
      }
      default:
        res.sendStatus(404);
        return;
    }
    res.json({ ok: true });
  },
);
const uri = "ui://newids/investigation.html";
const mime = "text/html;profile=mcp-app";
const html = readFileSync(
  new URL("../src/panel.html", import.meta.url),
  "utf8",
).replace("/*APP*/", () =>
  readFileSync(new URL("./view.js", import.meta.url), "utf8").replace(
    /<\/script/gi,
    "<\\/script",
  ),
);
function buildMcp(user: { id: string; hosts: string[] }) {
  const m = new McpServer({ name: "newids", version: "1.1.0" });
  const meta = { ui: { resourceUri: uri } };
  function pack(data: Record<string, unknown>) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: data,
    };
  }
  function authorize(host: string) {
    if (!user.hosts.includes(host)) throw Error("Host unavailable");
    return host;
  }
  m.registerResource("Investigation", uri, { mimeType: mime }, async () => ({
    contents: [{ uri, mimeType: mime, text: html }],
  }));
  m.registerTool(
    "list_hosts",
    {
      description: "List authorized endpoints and detector health",
      inputSchema: {},
      _meta: meta,
    },
    () => pack({ hosts: db.hosts(user.hosts) }),
  );
  m.registerTool(
    "list_alerts",
    {
      description: "List recent alerts, newest first",
      _meta: meta,
      inputSchema: {
        host_id: label.optional(),
        from: z.iso.datetime().optional(),
        until: z.iso.datetime().optional(),
        min_risk: z.number().min(0).max(1).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      },
    },
    (q) =>
      pack({
        alerts: db.alerts(
          q.host_id ? [authorize(q.host_id)] : user.hosts,
          q.from ? new Date(q.from).toISOString() : "",
          q.until ? new Date(q.until).toISOString() : "9999",
          q.min_risk,
          q.limit,
        ),
      }),
  );
  m.registerTool(
    "get_alert",
    {
      description: "Read captured process evidence and model probabilities",
      _meta: meta,
      inputSchema: { alert_id: z.uuid() },
    },
    (q) => pack(db.getAlert(user.hosts, q.alert_id)),
  );
  m.registerTool(
    "newbox_exec",
    {
      description:
        "Run a read-only Newbox diagnostic on an authorized endpoint. Supply argv or script, then poll get_execution.",
      _meta: meta,
      inputSchema: {
        host_id: label,
        argv: z.array(z.string()).optional(),
        script: z.string().optional(),
        alert_id: z.uuid().optional(),
      },
    },
    (q) => {
      if ((q.argv === undefined) === (q.script === undefined))
        throw Error("Supply exactly one of argv or script");
      const cmd = command.parse(
        q.argv
          ? { kind: "argv", argv: q.argv }
          : { kind: "script", script: q.script },
      );
      return pack(db.enqueue(authorize(q.host_id), user.id, cmd, q.alert_id));
    },
  );
  m.registerTool(
    "get_execution",
    {
      description: "Read diagnostic status, collection time, output and policy",
      _meta: meta,
      inputSchema: { execution_id: z.uuid() },
    },
    (q) => pack(db.execution(user.hosts, q.execution_id)),
  );
  return m;
}
app.post(
  "/mcp",
  (req, res, next) => {
    const token = bearer(req);
    const user =
      authenticated(req, config.users) ?? (token && consoleAuth?.user(token));
    if (!user) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="newids"');
      res.sendStatus(401);
      return;
    }
    res.locals.user = { id: user.id, hosts: user.hosts };
    next();
  },
  express.json({ limit: "2mb" }),
  async (req, res) => {
    const user = z
      .object({ id: label, hosts: z.array(label) })
      .parse(res.locals.user);
    if (!user) {
      res.sendStatus(401);
      return;
    }
    const m = buildMcp(user);
    const t = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void m.close();
    });
    await m.connect(t);
    await t.handleRequest(req, res, req.body);
  },
);
app.all("/mcp", (_req, res) => {
  res.setHeader("Allow", "POST");
  res.sendStatus(405);
});
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    console.error(error instanceof Error ? error.name : "Unexpected error");
    res.sendStatus(500);
  },
);
if (config.tls)
  createServer(
    { cert: readFileSync(config.tls.cert), key: readFileSync(config.tls.key) },
    app,
  ).listen(config.port, config.listen);
else app.listen(config.port, config.listen);
