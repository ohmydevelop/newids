#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $EUID != 0 || $# != 3 ]]; then echo "用法: sudo bash install-server.sh https://ids.example.com:8443 fullchain.pem privkey.pem" >&2; exit 2; fi
src=$(cd "$(dirname "$0")" && pwd)
origin=$1
test -r "$2" && test -r "$3"
(cd "$src" && sha256sum -c BINARIES.sha256)
if ! "$src/server/runtime/node" --version >/dev/null 2>&1; then
 if command -v apt-get >/dev/null; then
   apt-get update
   DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libatomic1 libstdc++6
 elif command -v dnf >/dev/null; then
   dnf install -y libatomic libstdc++
 fi
fi
port=$("$src/server/runtime/node" -e 'const u=new URL(process.argv[1]);if(u.protocol!=="https:"||u.origin!==process.argv[1])process.exit(2);process.stdout.write(u.port||"443")' "$origin")
if [[ -e /etc/newids/server.json ]]; then
 if [[ -f /etc/newids/admin-login ]] && "$src/server/runtime/node" -e 'const c=require("/etc/newids/server.json");process.exit(c.origin===process.argv[1]&&c.admin?0:1)' "$origin"; then
   echo "继续安装，沿用已有管理凭据。"
 else
   echo "已有其他配置，已停止安装。" >&2; exit 1
 fi
fi
getent passwd newids-server >/dev/null || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin newids-server
install -d -m755 /opt/newids /etc/newids
if [[ "$src" != /opt/newids ]]; then cp -an "$src/server" /opt/newids/; fi
install -d -m750 -g newids-server /etc/newids/tls
install -m640 -g newids-server "$2" /etc/newids/tls/server.pem
install -m640 -g newids-server "$3" /etc/newids/tls/server.key
if [[ ! -f /etc/newids/server.json ]]; then
/opt/newids/server/runtime/node --input-type=module - "$origin" "$port" <<'JS'
import {randomBytes,scryptSync} from "node:crypto";
import fs from "node:fs";
const [origin,port]=process.argv.slice(2);
const password=randomBytes(24).toString("base64url"),salt=randomBytes(16).toString("hex");
const conf={origin,port:Number(port),listen:"0.0.0.0",database:"/var/lib/newids-server/platform.sqlite",tls:{cert:"/etc/newids/tls/server.pem",key:"/etc/newids/tls/server.key"},admin:{id:"admin",salt,hash:scryptSync(password,salt,32).toString("hex")},hosts:[],users:[]};
fs.writeFileSync("/etc/newids/admin-login", "admin\n"+password+"\n",{mode:0o600});
fs.writeFileSync("/etc/newids/server.json", JSON.stringify(conf,null,2),{mode:0o600,flag:"wx"});
JS
fi
chgrp newids-server /etc/newids/server.json
chmod 640 /etc/newids/server.json
install -m644 /opt/newids/server/newids-server.service /etc/systemd/system/
if ((port < 1024)); then
 install -d /etc/systemd/system/newids-server.service.d
 printf '[Service]\nAmbientCapabilities=CAP_NET_BIND_SERVICE\n' >/etc/systemd/system/newids-server.service.d/port.conf
fi
systemctl daemon-reload
systemctl enable --now newids-server
printf '管理界面 %s/admin\n管理员账号和密码见 sudo cat /etc/newids/admin-login\n' "$origin"
