import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
const app = new App({ name: "NewIDS investigation", version: "1.1.1" });
const main = document.querySelector("main")!;
const record = z.record(z.string(), z.unknown());
function line(parent: Element, tag: string, text: string) {
  const el = document.createElement(tag);
  el.textContent = text;
  parent.append(el);
  return el;
}
async function call(name: string, args: Record<string, unknown> = {}) {
  try {
    const r = await app.callServerTool({ name, arguments: args });
    show(r.structuredContent ?? { message: r.content });
  } catch (e) {
    main.textContent = String(e);
  }
}
function button(parent: Element, title: string, action: () => void) {
  const b = line(parent, "button", title);
  b.addEventListener("click", action);
}
function show(value: unknown) {
  main.replaceChildren();
  const v = record.parse(value);
  if (Array.isArray(v.hosts) || Array.isArray(v.alerts)) {
    const items = z.array(record).parse(v.hosts ?? v.alerts);
    if (!items.length) line(main, "p", "暂无记录");
    for (const item of items) {
      const row = document.createElement("article");
      main.append(row);
      if (typeof item.alert_id === "string") {
        line(row, "small", String(item.occurred_at));
        line(row, "h2", String(item.executable));
        line(
          row,
          "p",
          String(item.host_id) + " · 风险 " + Number(item.risk).toFixed(3),
        );
        button(
          row,
          "查看事件",
          () => void call("get_alert", { alert_id: item.alert_id }),
        );
      } else {
        line(
          row,
          "h2",
          String(item.host_id) + " · " + (item.online ? "在线" : "离线"),
        );
        line(
          row,
          "p",
          "检测器" +
            (item.detector_online ? "在线" : "离线") +
            " · 最近心跳 " +
            (item.last_seen ?? "尚无记录"),
        );
        if (item.health) line(row, "pre", JSON.stringify(item.health, null, 2));
        button(
          row,
          "主机告警",
          () => void call("list_alerts", { host_id: item.host_id }),
        );
      }
    }
  } else {
    if (v.execution_id)
      button(
        main,
        "刷新调查结果",
        () => void call("get_execution", { execution_id: v.execution_id }),
      );
    if (v.state)
      line(main, "p", [v.host_id, v.state].filter(Boolean).join(" · "));
    if (v.occurred_at) {
      line(main, "h2", "事件发生时间 " + String(v.occurred_at));
      line(
        main,
        "p",
        String(v.host_id) +
          " · UID " +
          v.uid +
          " · PID " +
          v.pid +
          " · 父 PID " +
          v.ppid,
      );
      line(main, "h3", String(v.executable));
      line(main, "pre", JSON.stringify(v.argv));
      line(main, "p", "风险 " + Number(v.risk).toFixed(3) + " · " + v.model);
      const details = line(main, "details", "");
      line(details, "summary", "模型与行为概率");
      line(
        details,
        "pre",
        JSON.stringify(
          { model_identity: v.model_identity, behaviors: v.behaviors },
          null,
          2,
        ),
      );
    }
    if (v.result) {
      const r = record.parse(v.result);
      line(main, "h2", "现场采集时间 " + String(r.collected_at));
      line(
        main,
        "p",
        "退出码 " +
          r.exit_code +
          (r.duration_ms === undefined ? "" : " · " + r.duration_ms + " ms") +
          (r.truncated ? " · 输出已截断" : "") +
          (r.timed_out ? " · 已超时" : ""),
      );
      line(main, "h3", "标准输出");
      line(main, "pre", String(r.stdout || "（空）"));
      if (r.stderr || r.error) {
        line(main, "h3", "诊断信息");
        line(main, "pre", [r.stderr, r.error].filter(Boolean).join("\n"));
      }
      const details = line(main, "details", "");
      line(details, "summary", "执行策略与审计");
      line(
        details,
        "pre",
        JSON.stringify(
          { actor: v.actor, command: v.command, policy: r.policy },
          null,
          2,
        ),
      );
    }
    if (v.message) line(main, "pre", JSON.stringify(v.message, null, 2));
  }
}
app.ontoolresult = (r) => show(r.structuredContent ?? { message: r.content });
document
  .querySelector("#hosts")
  ?.addEventListener("click", () => void call("list_hosts"));
document
  .querySelector("#alerts")
  ?.addEventListener("click", () => void call("list_alerts"));
void app.connect().catch((e) => {
  main.textContent = String(e);
});
