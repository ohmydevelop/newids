import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const label = z.string().min(1).max(128);
const counts = z.number().int().nonnegative();
export const health = z.object({
  scored: counts,
  dropped: counts,
  incomplete: counts,
  score_errors: counts,
  pending: counts,
  scoring_backlog: counts.default(0),
});
const probability = z.number().min(0).max(1);
export const alert = z.object({
  event_id: label,
  occurred_at: z.iso.datetime(),
  executable: z.string(),
  argv: z.array(z.string()).nonempty(),
  uid: counts,
  pid: counts,
  ppid: counts,
  model: label,
  model_identity: label,
  risk: probability,
  behaviors: z.record(z.string(), probability),
});
export const policy = z.object({
  mounts: z.array(z.string()),
  system_info: z.boolean(),
  timeout_seconds: z.number().int().min(1).max(60),
  output_bytes: counts,
});
export const result = z.object({
  collected_at: z.iso.datetime(),
  duration_ms: counts.optional(),
  stdout: z.string(),
  stderr: z.string(),
  exit_code: z.number().int(),
  truncated: z.boolean(),
  timed_out: z.boolean(),
  error: z.string().nullable(),
  policy,
});
export const command = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("argv"),
    argv: z
      .tuple([z.string().regex(/^[a-z][a-z0-9_-]*$/)])
      .rest(z.string().max(16384))
      .refine((a) => a.length <= 256),
  }),
  z.object({ kind: z.literal("script"), script: z.string().min(1).max(65536) }),
]);
const onlineMs = 30_000;
export class Store {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS hosts(id TEXT PRIMARY KEY, seen INTEGER NOT NULL DEFAULT 0, policy TEXT, health TEXT, detector_seen INTEGER);
      CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY, host TEXT NOT NULL, event TEXT NOT NULL, occurred TEXT NOT NULL, risk REAL NOT NULL, data TEXT NOT NULL, UNIQUE(host,event));
      CREATE INDEX IF NOT EXISTS alerts_time ON alerts(host, occurred DESC);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,host TEXT NOT NULL,actor TEXT NOT NULL,alert_id TEXT,command TEXT NOT NULL,policy TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,claimed INTEGER,result TEXT);
      CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(host,state,created);
    `);
  }
  detector(h: string, data: z.infer<typeof health>) {
    this.db
      .prepare(
        "INSERT INTO hosts(id,health,detector_seen) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET health=excluded.health,detector_seen=excluded.detector_seen",
      )
      .run(h, JSON.stringify(data), Date.now());
  }
  heartbeat(h: string, data: z.infer<typeof policy>) {
    this.db
      .prepare(
        "INSERT INTO hosts(id,seen,policy) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET seen=excluded.seen,policy=excluded.policy",
      )
      .run(h, Date.now(), JSON.stringify(data));
  }
  hosts(ids: string[]) {
    return ids.map((host_id) => {
      const row = this.db
        .prepare("SELECT * FROM hosts WHERE id=?")
        .get(host_id);
      const seen = Number(row?.seen || 0),
        detector = Number(row?.detector_seen || 0);
      return {
        host_id,
        online: Date.now() - seen < onlineMs,
        last_seen: seen ? new Date(seen).toISOString() : null,
        detector_online: Date.now() - detector < onlineMs,
        health: row?.health
          ? health.parse(JSON.parse(String(row.health)))
          : null,
      };
    });
  }
  ingest(h: string, a: z.infer<typeof alert>) {
    this.db
      .prepare(
        "INSERT INTO alerts VALUES(?,?,?,?,?,?) ON CONFLICT(host,event) DO NOTHING",
      )
      .run(
        randomUUID(),
        h,
        a.event_id,
        new Date(a.occurred_at).toISOString(),
        a.risk,
        JSON.stringify(a),
      );
  }
  alerts(
    hosts: string[],
    from: string,
    until: string,
    min: number,
    limit: number,
  ) {
    return this.db
      .prepare(
        `SELECT id AS alert_id,host AS host_id,occurred AS occurred_at,risk,json_extract(data,'$.executable') AS executable FROM alerts WHERE host IN (SELECT value FROM json_each(?)) AND occurred BETWEEN ? AND ? AND risk>=? ORDER BY occurred DESC,id LIMIT ?`,
      )
      .all(JSON.stringify(hosts), from, until, min, limit);
  }
  getAlert(hosts: string[], id: string) {
    const row = this.db
      .prepare(
        "SELECT host,data FROM alerts WHERE id=? AND host IN (SELECT value FROM json_each(?))",
      )
      .get(id, JSON.stringify(hosts));
    if (!row) throw Error("Alert unavailable");
    return {
      alert_id: id,
      host_id: String(row.host),
      ...alert.parse(JSON.parse(String(row.data))),
    };
  }
  enqueue(
    host: string,
    actor: string,
    cmd: z.infer<typeof command>,
    alertId?: string,
  ) {
    if (alertId) this.getAlert([host], alertId);
    const row = this.db
      .prepare("SELECT seen,policy FROM hosts WHERE id=?")
      .get(host);
    const state =
      row && Number(row.seen) >= Date.now() - onlineMs ? "queued" : "offline";
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO jobs(id,host,actor,alert_id,command,policy,state,created) VALUES(?,?,?,?,?,?,?,?)",
      )
      .run(
        id,
        host,
        actor,
        alertId ?? null,
        JSON.stringify(cmd),
        row?.policy ?? "null",
        state,
        Date.now(),
      );
    return { execution_id: id, host_id: host, state };
  }
  expire() {
    this.db
      .prepare(
        "UPDATE jobs SET state='expired' WHERE state='queued' AND created<?",
      )
      .run(Date.now() - onlineMs);
    this.db
      .prepare(
        "UPDATE jobs SET state='unknown' WHERE state='running' AND claimed<?",
      )
      .run(Date.now() - 90_000);
  }
  claim(h: string) {
    this.expire();
    const row = this.db
      .prepare(
        "UPDATE jobs SET state='running',claimed=? WHERE id=(SELECT id FROM jobs WHERE host=? AND state='queued' ORDER BY created,id LIMIT 1) RETURNING id,command",
      )
      .get(Date.now(), h);
    return row
      ? { id: row.id, command: command.parse(JSON.parse(String(row.command))) }
      : null;
  }
  finish(h: string, id: string, r: z.infer<typeof result>) {
    const data = JSON.stringify(r);
    return !!this.db
      .prepare(
        "UPDATE jobs SET result=?,state='finished' WHERE host=? AND id=? AND (state IN ('running','unknown') OR (state='finished' AND result=?))",
      )
      .run(data, h, id, data).changes;
  }
  execution(hosts: string[], id: string) {
    this.expire();
    const row = this.db
      .prepare(
        "SELECT * FROM jobs WHERE id=? AND host IN (SELECT value FROM json_each(?))",
      )
      .get(id, JSON.stringify(hosts));
    if (!row) throw Error("Execution unavailable");
    return {
      execution_id: id,
      host_id: row.host,
      actor: row.actor,
      alert_id: row.alert_id,
      state: row.state,
      requested_at: new Date(Number(row.created)).toISOString(),
      command: command.parse(JSON.parse(String(row.command))),
      requested_policy: policy.nullable().parse(JSON.parse(String(row.policy))),
      result: row.result ? result.parse(JSON.parse(String(row.result))) : null,
    };
  }
}
