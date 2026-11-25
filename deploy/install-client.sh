#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $EUID != 0 || $# != 3 ]]; then echo '请在探针主机上运行管理页生成的命令。' >&2; exit 2; fi
origin=$1 host=$2 invite=$3
[[ $(uname -m) == x86_64 ]] || { echo '仅支持 Linux x86_64' >&2; exit 1; }
missing=false
for tool in auditctl augenrules curl openssl python3 setpriv; do command -v "$tool" >/dev/null || missing=true; done
if [[ $missing == true ]]; then
 if command -v apt-get >/dev/null; then
   apt-get update
   DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends auditd curl ca-certificates openssl python3 util-linux
 elif command -v dnf >/dev/null; then
   dnf install -y audit curl ca-certificates openssl python3 util-linux
 elif command -v pacman >/dev/null; then
   pacman -S --needed --noconfirm audit curl ca-certificates openssl python util-linux
 fi
fi
python3 - "$origin" <<'PYURL'
import sys,urllib.parse
u=urllib.parse.urlsplit(sys.argv[1])
if u.scheme!="https" or not u.hostname or u.username or u.password or u.path or u.query or u.fragment:
    sys.exit("无效的平台 HTTPS 地址")
PYURL
[[ $host =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$ && $invite =~ ^[a-f0-9]{64}$ ]]
for tool in curl openssl python3 auditctl augenrules setpriv systemctl tar sha256sum flock; do command -v "$tool" >/dev/null || { echo "需要安装 $tool" >&2; exit 1; }; done
test -f /etc/audit/auditd.conf
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
install -d -m755 /etc/newids /opt/newids
exec 9>/etc/newids/install.lock
flock -n 9
state=/etc/newids/enrollment.json
if [[ ! -f "$state" && ( -f /etc/newids/worker.json || -f /etc/newids/collector.json ) ]]; then echo '检测到已有手工配置，已停止安装。' >&2; exit 1; fi
cd "$stage"
curl -fsS "$origin/downloads/client.tar.gz" -o client.tar.gz
curl -fsS "$origin/downloads/client.tar.gz.sha256" -o SHA256SUMS
sha256sum -c SHA256SUMS
tar -xzf client.tar.gz
for role in worker collector; do
 getent passwd "newids-$role" >/dev/null || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "newids-$role"
done
install -d -m700 -o newids-collector -g newids-collector /var/lib/newids-collector
# Save the candidate credential before exchange so a lost HTTP response is recoverable.
python3 - "$state" "$origin" "$host" "$invite" <<'PY'
import json,os,secrets,sys
state,origin,host,invite=sys.argv[1:]
if os.path.exists(state):
    with open(state) as f: data=json.load(f)
    if (origin,host)!=(data["server"],data["host"]):sys.exit("已与其他平台或主机名关联")
else:
    data=dict(server=origin,host=host,device=secrets.token_hex(32))
    with open(state+".tmp","w") as f:json.dump(data,f)
    os.replace(state+".tmp",state)
with open("exchange","w") as f:json.dump(dict(host=host,invite=invite,device=data["device"]),f)
with open("authorization","w") as f:f.write("Authorization: Bearer "+data["device"]+"\n")
PY
status=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data-binary @exchange "$origin/v1/pair")
if [[ $status != 204 ]]; then
 curl -fsS -H @authorization "$origin/v1/identity" -o identity
 python3 -c 'import json,sys;sys.exit(json.load(open("identity"))["host"]!=sys.argv[1])' "$host"
fi
install -d -m755 /opt/newids/client
# Rename complete files on the same filesystem; running processes retain their executable inode.
copy=$(mktemp -d /opt/newids/.probe-install.XXXXXX)
trap 'rm -rf "$stage" "$copy"' EXIT
cp -a client/. "$copy/"
for file in "$copy"/*; do
 if [[ -d $file ]]; then cp -a "$file" /opt/newids/client/; else mv -f "$file" /opt/newids/client/; fi
done
python3 - "$state" <<'PY'
import json,sys
with open(sys.argv[1]) as f:s=json.load(f)
for role in ("collector","worker"):
    with open("client/"+role+".json.example") as f:c=json.load(f)
    c.update(server=s["server"],token=s["device"])
    with open(role+".json","w") as f:json.dump(c,f)
PY
for role in collector worker; do
 [[ -e /etc/newids/$role.json ]] || install -m640 -g "newids-$role" "$role.json" "/etc/newids/$role.json"
done
install -m644 client/newids-worker.service /etc/systemd/system/
install -D -m640 client/newids.conf /etc/audit/plugins.d/newids.conf
install -D -m640 client/60-newids.rules /etc/audit/rules.d/60-newids.rules
if ! grep -Eiq '^[[:space:]]*log_format[[:space:]]*=[[:space:]]*ENRICHED[[:space:]]*$' /etc/audit/auditd.conf; then
 cp -an /etc/audit/auditd.conf /etc/audit/auditd.conf.pre-newids
 sed -i '/^[[:space:]]*log_format[[:space:]]*=/Id' /etc/audit/auditd.conf
 printf '\nlog_format = ENRICHED\n' >> /etc/audit/auditd.conf
fi
systemctl daemon-reload
systemctl enable --now auditd
augenrules --load
auditctl -l | grep 'newids_exec' >/dev/null
systemctl kill --kill-who=main --signal=HUP auditd
systemctl enable --now newids-worker
echo "探针 $host 已安装。请在管理页核对执行器和检测器心跳。"
