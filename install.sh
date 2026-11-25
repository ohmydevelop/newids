#!/usr/bin/env bash
set -euo pipefail
main() (
  if [[ $EUID != 0 || ( $# != 0 && $# != 3 ) ]]; then
    echo '用法：sudo bash install.sh [HTTPS地址 证书链路径 私钥路径]' >&2
    return 2
  fi
  local work pkg base
  if (( $# == 3 )); then set -- "$1" "$(realpath -e -- "$2")" "$(realpath -e -- "$3")"; fi
  umask 077
  work=$(mktemp -d)
  trap 'rm -rf -- "$work"' EXIT
  pkg=newids-v1.1.1-all-in-one-linux-x86_64.tar.gz
  base=https://github.com/ohmydevelop/newids/releases/download/v1.1.1
  cd "$work"
  curl -fLsS --retry 2 "$base/$pkg" -o "$pkg"
  printf '%s  %s\n' 'bcc6f8de2ca66e31c61f9393caf9d7078184274f1c22d4652bcccc2e1160847f' "$pkg" | sha256sum -c -
  tar -xzf "$pkg"
  bash ./install-server.sh "$@"
)
main "$@"
