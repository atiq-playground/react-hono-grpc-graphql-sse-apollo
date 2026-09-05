#!/usr/bin/env bash
# Bring up ClickHouse + Redis and wait until both are healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker/compose.yml}"

if [[ ! -S /var/run/docker.sock ]] && [[ -z "${DOCKER_HOST:-}" ]]; then
  echo "error: Docker daemon is not reachable (missing /var/run/docker.sock)." >&2
  echo "Enable Docker Desktop → Settings → Resources → WSL Integration for this distro," >&2
  echo "then re-run: bun run infra:up" >&2
  exit 1
fi

cd "$ROOT"
docker compose -f "$COMPOSE_FILE" up -d
bash "$ROOT/tools/infra/scripts/wait-healthy.sh"
