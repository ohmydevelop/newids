# NewIDS

Linux x86_64 命令检测与只读调查平台。Go 客户端接入 Linux Audit 和 ShellGuard。外部 Agent 通过平台 MCP 调用端点 Newbox。单团队单实例部署，用户可以直接选择主机调查，也可以从告警进入。

## 安装 Server

v1.1.0 一体包内置客户端、服务端、ShellGuard CLI、Newbox 和 Node.js 运行时。以下步骤适用于首次部署的 Linux x86_64 主机，要求 glibc 和 systemd。准备一个浏览器和探针都能访问的 HTTPS 地址，以及与域名匹配的证书链和私钥。已在 Debian 12 验证。[下载 v1.1.0](https://github.com/ohmydevelop/newids/releases/tag/v1.1.0)

先下载并校验两个 Release 附件，再解压到安装目录：

```bash
(
  set -eu
  base=https://github.com/ohmydevelop/newids/releases/download/v1.1.0
  pkg=newids-v1.1.0-all-in-one-linux-x86_64.tar.gz
  curl -fLO "$base/$pkg"
  curl -fLO "$base/$pkg.sha256"
  sha256sum -c "$pkg.sha256"
  sudo install -d -m755 /opt/newids
  sudo tar -xzf "$pkg" -C /opt/newids
)
```

把下面的域名和证书路径替换为部署机的实际值，执行一条命令即可安装并启动 Server：

```bash
sudo bash /opt/newids/install-server.sh https://ids.example.com:8443 /path/to/fullchain.pem /path/to/privkey.pem
```

在 Server 上运行 `sudo cat /etc/newids/admin-login` 查看初始账号和密码。打开 `https://ids.example.com:8443/admin` 登录。使用私有 CA 时，请先将该 CA 加入浏览器、探针主机和 MCP 客户端的信任库。

## 配对并安装探针

1. 在管理页的「安装探针」输入唯一主机名，例如 `linux-01`，点击「生成配对命令」。
2. 在**目标探针主机**上复制执行整条 Bash 命令。主机需能通过 HTTPS 连接 Server，并提供 Bash、curl、sudo 和 systemd。安装器从 Server 下载并校验客户端，登记端点凭据，安装 Audit 采集器和 Newbox 执行器，并加载审计规则。它会按需通过 apt、dnf 或 pacman 补齐依赖，离线环境需预装。变更 auditd 日志格式前会保留原始配置备份。
3. 回到管理页点击「刷新」，确认该主机的**执行器和检测器均在线**。配对码单次有效，10 分钟过期。未完成兑换时可重新生成命令；配对后安装中断可在原主机重跑原命令。

## 获取 MCP Key

登录后点击「生成 MCP Key」，把新 Key 保存到外部 Agent 的 `NEWIDS_MCP_TOKEN` 环境变量，MCP 地址为 `https://ids.example.com:8443/mcp`。该 Key 可调查此平台上的所有已授权给管理员的探针，轮换会立即停用旧 Key。用 `list_hosts` 核对 Agent 能看到刚配对的主机。[Codex 配置示例](#mcp-接入与验收)

## 从源码构建

此流程需要能够取得 ShellGuard 和 Newbox 上游二进制。使用上方 Release 安装时，两者已随包提供。

需要 Go 1.25+、Node.js 24+、npm、Linux Audit、util-linux 和 systemd。准备 [ShellGuard cli-v1.0.0](https://github.com/ohmydevelop/ShellGuard/releases/tag/cli-v1.0.0) 的 shellguard，以及支持 --restricted 的 [Newbox](https://github.com/ohmydevelop/newbox) Linux x86_64 发行程序。在仓库根目录执行：

```sh
SHELLGUARD_BIN=/absolute/path/shellguard NEWBOX_BIN=/absolute/path/newbox ./deploy/package.sh
(cd release && sha256sum -c SHA256SUMS)
```

release 中另外两个按角色拆分的压缩包分别含运行程序、配置和服务文件。服务端包内已包含运行依赖，需要部署机提供 Node。

## 手工安装平台

解压 server 包到 /opt/newids，创建专用用户与配置，示例如下。将真实服务域名的 TLS 证书及私钥置于配置指定路径，仅授权服务账户读取私钥。分别用 openssl rand -hex 32 生成用户、端点随机凭据；每台端点使用不同凭据。server.json 的 users[].hosts 是该用户可调查的主机清单。替换所有示例值后启动。

```sh
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin newids-server
install -d -m755 /etc/newids
install -m640 -o root -g newids-server /opt/newids/server/server.json.example /etc/newids/server.json
install -m644 /opt/newids/server/newids-server.service /etc/systemd/system/
# 编辑 /etc/newids/server.json 并配置 TLS
systemctl daemon-reload
systemctl enable --now newids-server
```

允许端点和 MCP 宿主连接平台端口。私有 CA 应加入端点系统信任库及宿主信任库。仅在本机联调时可以省略 tls，listen 设为 127.0.0.1 并使用 HTTP。

## 手工安装端点

解压 client 包到 /opt/newids。为 collector 与 worker 配置相同的端点凭据及平台 URL。单独制定 worker 的取证目录，如 mounts 设置为 ["/logs=/var/log/myapp"]。服务账户需有相应读取权限。空列表只开放会话内存。system_info 控制系统快照。客户端始终传入 --restricted。调查凭据和 collector 队列应放在授权目录之外。

```sh
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin newids-worker
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin newids-collector
install -d -m755 /etc/newids
install -d -m700 -o newids-collector -g newids-collector /var/lib/newids-collector
for role in collector worker; do
  install -m640 -o root -g "newids-$role" "/opt/newids/client/$role.json.example" "/etc/newids/$role.json"
done
# 编辑两份配置，按真实运维样本设置 threshold；0 可用于联调
install -m644 /opt/newids/client/newids-worker.service /etc/systemd/system/
install -m640 /opt/newids/client/newids.conf /etc/audit/plugins.d/newids.conf
install -m640 /opt/newids/client/60-newids.rules /etc/audit/rules.d/
augenrules --load
systemctl daemon-reload
systemctl enable --now newids-worker
```

本次独立虚拟机验收使用 auditd 4.2.1，并在 /etc/audit/auditd.conf 设置 `log_format = ENRICHED`。该版本在 RAW 模式联调时出现分发记录末尾缺失，表现为 incomplete 增长、缺少告警。部署此版本时采用已验收的 ENRICHED 配置。按发行版方式启动或重新加载 auditd，使其加载分发插件。用 auditctl -l 确认 newids_exec 规则生效，注意既有 never 规则及不可变配置。客户端只采集成功的 execve/execveat 事件。重启前确认 spool 所在磁盘可写并有剩余空间。配置示例的 0.8 是试点阈值，需自行校准。

## MCP 接入与验收

将个人凭据通过环境变量 NEWIDS_MCP_TOKEN 提供给 Codex，在其 config.toml 中加入：

```toml
[mcp_servers.newids]
url = "https://ids.example.internal:8443/mcp"
bearer_token_env_var = "NEWIDS_MCP_TOKEN"
```

支持 Streamable HTTP 的其他宿主也可向同一 URL 发送 Bearer 凭据。支持 MCP Apps 的宿主可显示主机、时间线和调查面板。纯工具客户端可以调用以下流程：

1. list_hosts 返回主机、在线状态和检测器计数。
2. newbox_exec 接受 host_id，加上 argv（例如 ["printf","%s","hello world"]）或 script（例如 "printf hello | wc -c"）。可选 alert_id。执行参数只能选择 guest 命令。
3. get_execution 接受 execution_id，轮询到 finished、expired 或 unknown。结果含实际采集时间、输出、退出码、超时及截断标记。
4. 将测试机阈值设为 0，执行 /usr/bin/printf '%s' 'hello world'，用 list_alerts 查找该事件，再用 get_alert 核对 argv、进程信息和概率。恢复实际阈值。

根据 list_hosts 中的 scoring_backlog、pending、dropped、score_errors、incomplete 和离线状态跟踪端点；配合 auditctl -s 的 lost 监测内核侧丢失。平台 SQLite 含命令参数及诊断输出，使用系统权限保护并按团队保留策略备份与清理。上报中断时 bbolt 保存已评分告警；待评分事件队列有界，过载会计数。已派发调查若结果丢失标为 unknown。协议细节见 protocol/README.md。


## 复测

在完成打包后，以普通用户运行 `python3 tests/pilot.py`。脚本解包客户端和服务端，生成临时 TLS 证书并验证实际工具、授权、故障恢复和审计记录回放。`NEWIDS_TEST_CODEX=1` 增加真实 Codex app-server 调用，使用临时配置。`NEWIDS_TEST_UI=1` 增加 Chromium 中的 MCP Apps 交互验收，需要 Python Playwright 和 /usr/bin/chromium。Go 回归测试在 client 目录运行 `go test -race ./...`。

管理流程的浏览器回归可通过 `NEWIDS_TEST_ADMIN=1 NEWIDS_TEST_BUNDLE=release/newids-v1.1.0-all-in-one-linux-x86_64.tar.gz python3 tests/pilot.py` 运行，需要 Chromium 和 Python Playwright。
