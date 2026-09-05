#!/usr/bin/env bash
# Wait until ClickHouse and Redis compose services report healthy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker/compose.yml}"
TIMEOUT_SECONDS="${INFRA_HEALTH_TIMEOUT_SECONDS:-120}"
INTERVAL_SECONDS="${INFRA_HEALTH_INTERVAL_SECONDS:-2}"

cd "$ROOT"

deadline=$((SECONDS + TIMEOUT_SECONDS))

service_health() {
  local service="$1"
  local id
  id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$id" ]]; then
    echo "missing"
    return 0
  fi
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null \
    | tr '[:upper:]' '[:lower:]' \
    || echo "unknown"
}

echo "Waiting for ClickHouse and Redis (timeout ${TIMEOUT_SECONDS}s)..."

while (( SECONDS < deadline )); do
  ch="$(service_health clickhouse || true)"
  redis="$(service_health redis || true)"
  if [[ "$ch" == "healthy" && "$redis" == "healthy" ]]; then
    echo "ClickHouse: healthy"
    echo "Redis: healthy"
    exit 0
  fi
  echo "  clickhouse=${ch:-unknown} redis=${redis:-unknown}"
  sleep "$INTERVAL_SECONDS"
done

echo "error: services did not become healthy within ${TIMEOUT_SECONDS}s" >&2
docker compose -f "$COMPOSE_FILE" ps >&2 || true
exit 1
