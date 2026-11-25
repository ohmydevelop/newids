# 端点协议 v1

端点主动向平台发送 JSON POST，路径前缀为 `/v1/device/`。每次请求提供端点独有的 Bearer token。服务端从凭据派生主机身份。MCP 用户持有单独的用户凭据。远程连接使用 HTTPS。

| 操作 | 请求与结果 |
|---|---|
| heartbeat | 上报当前 mounts、system_info、timeout_seconds、output_bytes。30 秒内有执行器心跳即在线。 |
| health | 上报检测器本次运行的 scored、incomplete、dropped、score_errors 和待评分队列 scoring_backlog 和本地待上报告警数 pending。检测器心跳单独计时。 |
| alert | 发送发生时间、审计事件 ID、exe/argv、UID/PID/PPID、模型身份、风险概率和行为概率。平台按主机和事件 ID 去重。 |
| claim | 发送空对象。返回 job=null，或含 id 和带 kind 的 command 的 job。领取和标记 running 在一条 SQLite 更新中完成。 |
| finish | 发送 id 和 result，包括执行时间、实际策略、stdout/stderr、退出码、错误、超时和截断。平台持久化后确认，允许相同结果重传。 |

告警写入或去重后返回 HTTP 200。执行器只运行成功领取的任务。队列中超过 30 秒未领取的任务为 expired，领取后超过 90 秒未收到结果为 unknown，两种情况均不会自动重派。迟到的真实结果可把 unknown 更新为 finished。finished 表示结果已收到，命令成败见退出码。验证约束见 server/src/store.ts。
