#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${HOSTINGER_SSH_HOST:-hostinger}"
APP_DIR="${HOSTINGER_APP_DIR:-/opt/apps/axeai}"
SHA="$(git rev-parse HEAD)"
RELEASE_DIR="${APP_DIR}/shared/remote-client-releases/${SHA}"

for command_name in git pnpm rsync ssh; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

pnpm exec turbo run build:embed --filter=@bb/app
ssh "${REMOTE}" "install -d -m 0755 '${RELEASE_DIR}' '${APP_DIR}/shared/remote-client-releases'"
rsync -az --delete apps/app/dist-embed/ "${REMOTE}:${RELEASE_DIR}/"
ssh "${REMOTE}" "set -euo pipefail
setfacl -R -m u:caddy:rx '${RELEASE_DIR}'
setfacl -R -d -m u:caddy:rx '${RELEASE_DIR}'
ln -s '${RELEASE_DIR}' '${APP_DIR}/shared/.remote-client.${SHA}'
mv -Tf '${APP_DIR}/shared/.remote-client.${SHA}' '${APP_DIR}/shared/remote-client'
test -f '${APP_DIR}/shared/remote-client/embed.html'
"
