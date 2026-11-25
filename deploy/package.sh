#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SHELLGUARD_BIN:?Set SHELLGUARD_BIN to the upstream cli-v1.0.0 Linux binary}"
: "${NEWBOX_BIN:?Set NEWBOX_BIN to a Linux x86_64 Newbox with --restricted support}"
printf '%s  %s\n' 56b8bb75f3b9de5d85c15973a51ba6ef339e5a329a392822b5633dd800b5ab00 "$SHELLGUARD_BIN" | sha256sum -c -
"$NEWBOX_BIN" --json --restricted echo newids | node -e "if (JSON.parse(require('fs').readFileSync(0)).stdout !== 'newids\n') process.exit(1)"
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/client" "$stage/server/src" release
(cd client && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o "$stage/client/newids-client" .)
install -m755 "$SHELLGUARD_BIN" "$stage/client/shellguard"
install -m755 "$NEWBOX_BIN" "$stage/client/newbox"
cp -a deploy/client/. "$stage/client/"
(cd server && npm ci --no-audit --no-fund && npm run build)
cp -r server/dist server/package*.json "$stage/server/"
cp server/src/{panel,admin}.html "$stage/server/src/"
cp -a deploy/server/. "$stage/server/"
(cd "$stage/server" && npm ci --omit=dev --no-audit --no-fund)
for part in client server; do
 cp README.md "$stage/$part/"
 tar --owner=0 --group=0 --numeric-owner -czf "release/newids-$part-linux-x86_64.tar.gz" -C "$stage" "$part"
 if [[ "$part" = client ]]; then
   mkdir -p "$stage/server/downloads"
   cp "release/newids-$part-linux-x86_64.tar.gz" "$stage/server/downloads/client.tar.gz"
   cp deploy/install-client.sh "$stage/server/downloads/"
   (cd "$stage/server/downloads" && sha256sum client.tar.gz > client.tar.gz.sha256)
 fi
done
version=$(node -p "require('./server/package.json').version")
name="newids-v$version-all-in-one-linux-x86_64"
node_bin=$(node -p process.execPath)
node_license="$(dirname "$node_bin")/../LICENSE"
test "$(node -p 'process.platform + "-" + process.arch')" = linux-x64
mkdir -p "$stage/server/runtime"
install -m755 "$node_bin" "$stage/server/runtime/node"
install -m644 "${NODE_LICENSE:-$node_license}" "$stage/server/runtime/LICENSE"
sed -i 's|/usr/bin/env node |/opt/newids/server/runtime/node |' "$stage/server/newids-server.service"
cp README.md deploy/install-server.sh "$stage/"
(
 cd "$stage"
 printf 'NewIDS %s\nShellGuard CLI 1.0.0\nNewbox %s\nNode.js %s\n' \
   "$version" "$(client/newbox --version)" "$(server/runtime/node --version)" > VERSIONS
 sha256sum client/newids-client client/shellguard client/newbox server/runtime/node > BINARIES.sha256
)
archive="$name.tar.gz"
tar --owner=0 --group=0 --numeric-owner -czf "$stage/$archive" -C "$stage" client server install-server.sh README.md VERSIONS BINARIES.sha256
mv "$stage/$archive" "release/$archive"
(cd release && sha256sum "$archive" > "$archive.sha256" && sha256sum *.tar.gz > SHA256SUMS)
