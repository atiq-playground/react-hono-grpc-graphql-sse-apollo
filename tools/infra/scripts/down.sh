#!/usr/bin/env bash
# Tear down the stack. Pass --volumes (or -v) to remove named volumes (no orphans).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker/compose.yml}"

cd "$ROOT"

remove_volumes=0
for arg in "$@"; do
  case "$arg" in
    -v|--volumes) remove_volumes=1 ;;
    *)
      echo "usage: bash tools/infra/scripts/down.sh [--volumes|-v]" >&2
      exit 2
      ;;
  esac
done

if (( remove_volumes == 1 )); then
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
  echo "Stack stopped; named volumes removed."
else
  docker compose -f "$COMPOSE_FILE" down --remove-orphans
  echo "Stack stopped; volumes retained (pass --volumes to delete)."
fi
