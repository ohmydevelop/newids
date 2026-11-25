#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $EUID != 0 || ( $# != 0 && $# != 3 ) ]]; then echo "用法: sudo bash install-server.sh [HTTPS地址 证书链 私钥]" >&2; exit 2; fi
src=$(cd "$(dirname "$0")" && pwd)
install -d -m755 /etc/newids
exec 9>/etc/newids/server-install.lock
flock 9
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
(cd "$src" && sha256sum -c BINARIES.sha256)
if ! "$src/server/runtime/node" --version >/dev/null 2>&1; then
 if command -v apt-get >/dev/null; then
   apt-get update
   DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends libatomic1 libstdc++6
 elif command -v dnf >/dev/null; then
   dnf install -y libatomic libstdc++
 fi
fi
node="$src/server/runtime/node"
auto_ca=
if (( $# == 3 )); then
 origin=$1; cert=$2; key=$3
elif [[ -e /etc/newids/server.json ]]; then
 origin=$("$node" -p 'require("/etc/newids/server.json").origin')
 cert=$("$node" -p 'require("/etc/newids/server.json").tls.cert')
 key=$("$node" -p 'require("/etc/newids/server.json").tls.key')
 auto_ca=$("$node" -p 'require("/etc/newids/server.json").tls.probeCA || ""')
else
 # Ask the kernel for its preferred source address. Route lookup sends no packets.
 address=$(ip -4 route get 192.0.2.1 2>/dev/null | awk '{for(i=1;i<NF;i++) if($i=="src"){print $(i+1);exit}}' || true)
 if [[ -z $address ]]; then address=$(hostname -I | awk '{print $1}'); fi
 family=$("$node" -p 'require("node:net").isIP(process.argv[1])' "$address")
 case "$family" in 4) origin="https://$address:8443";; 6) origin="https://[$address]:8443";; *) echo "无法识别服务器 IP，请检查网卡配置。" >&2; exit 1;; esac
 cert=$stage/server.pem; key=$stage/server.key; auto_ca=$stage/ca.pem
 openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 3650 -subj '/CN=NewIDS local CA' \
   -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' -addext 'keyUsage=critical,keyCertSign,cRLSign' \
   -keyout "$stage/ca.key" -out "$auto_ca" 2>"$stage/openssl.log"
 openssl req -new -newkey rsa:2048 -nodes -subj "/CN=$address" -keyout "$key" -out "$stage/server.csr" 2>>"$stage/openssl.log"
 printf 'subjectAltName=IP:%s\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$address" >"$stage/extensions"
 openssl x509 -req -sha256 -days 825 -in "$stage/server.csr" -CA "$auto_ca" -CAkey "$stage/ca.key" -CAcreateserial -out "$cert" -extfile "$stage/extensions" 2>>"$stage/openssl.log"
fi
test -r "$cert" && test -r "$key"
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
[[ "$cert" -ef /etc/newids/tls/server.pem ]] || install -m640 -g newids-server "$cert" /etc/newids/tls/server.pem
[[ "$key" -ef /etc/newids/tls/server.key ]] || install -m640 -g newids-server "$key" /etc/newids/tls/server.key
if [[ -n $auto_ca && ! "$auto_ca" -ef /etc/newids/tls/ca.pem ]]; then install -m644 "$auto_ca" /etc/newids/tls/ca.pem; fi
if [[ ! -f /etc/newids/server.json ]]; then
/opt/newids/server/runtime/node --input-type=module - "$origin" "$port" "$auto_ca" <<'JS'
import {randomBytes,scryptSync} from "node:crypto";
import fs from "node:fs";
const [origin,port,ca]=process.argv.slice(2);
const password=randomBytes(24).toString("base64url"),salt=randomBytes(16).toString("hex");
const conf={origin,port:Number(port),listen:new URL(origin).hostname.startsWith("[")?"::":"0.0.0.0",database:"/var/lib/newids-server/platform.sqlite",tls:{cert:"/etc/newids/tls/server.pem",key:"/etc/newids/tls/server.key",...(ca?{probeCA:"/etc/newids/tls/ca.pem"}:{})},admin:{id:"admin",salt,hash:scryptSync(password,salt,32).toString("hex")},hosts:[],users:[]};
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
trust=()
if [[ -n $auto_ca ]]; then trust=(--cacert "$auto_ca"); fi
curl --noproxy '*' -fsS --retry 10 --retry-connrefused --retry-delay 1 "${trust[@]}" "$origin/admin" -o /dev/null
if [[ -n $auto_ca ]]; then
 echo '首次打开 Web 时，请核对浏览器显示的服务器证书 SHA-256 指纹：'
 openssl x509 -in "$cert" -noout -sha256 -fingerprint
fi
mapfile -t credentials </etc/newids/admin-login
printf '\nWeb 地址：%s/admin\n账号：%s\n密码：%s\n' "$origin" "${credentials[0]}" "${credentials[1]}"
