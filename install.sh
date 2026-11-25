#!/usr/bin/env bash
set -euo pipefail
main() (
  if [[ $EUID != 0 || $# != 3 ]]; then
    echo '用法：sudo bash install.sh https://域名:8443 证书链路径 私钥路径' >&2
    return 2
  fi
  local origin=$1 cert key work pkg base
  cert=$(realpath -e -- "$2")
  key=$(realpath -e -- "$3")
  [[ -r $cert && -r $key ]]
  umask 077
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT
  pkg=newids-v1.1.0-all-in-one-linux-x86_64.tar.gz
  base=https://github.com/ohmydevelop/newids/releases/download/v1.1.0
  cd "$work"
  curl -fLsS --retry 2 "$base/$pkg" -o "$pkg"
  printf '%s  %s\n' '91a97558ceb051d04f38f02decd5fb092ce7fb05c7897bd0395db599b9d0cd06' "$pkg" | sha256sum -c -
  tar -xzf "$pkg"
  bash ./install-server.sh "$origin" "$cert" "$key"
  mapfile -t credentials </etc/newids/admin-login
  printf '\nWeb 地址：%s/admin\n账号：%s\n密码：%s\n' "$origin" "${credentials[0]}" "${credentials[1]}"
)
main "$@"
