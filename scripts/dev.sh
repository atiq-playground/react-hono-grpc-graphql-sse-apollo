#!/usr/bin/env bash
# Bring up ClickHouse/Redis, then serve producer, gateway, and dashboard together.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Default listen ports (must match apps/*/server + dashboard vite.config).
PRODUCER_PORT="${PRODUCER_PORT:-50051}"
GATEWAY_PORT="${GATEWAY_PORT:-4000}"
DASHBOARD_PORT="${DASHBOARD_PORT:-4200}"
DEV_PORTS=("$PRODUCER_PORT" "$GATEWAY_PORT" "$DASHBOARD_PORT")

# Leaf servers started by `nx serve` — these can outlive the setsid process group
# when nx/bun reparents or starts a new session, leaving EADDRINUSE on the next run.
LEAF_PATTERNS=(
  'bun apps/producer/src/server\.ts'
  'bun apps/gateway/src/server\.ts'
  '(^|/)vite( |$).*--config apps/dashboard/vite\.config\.ts'
)

PIDS=()

port_listener_pids() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    # fuser prints "port/tcp:  pid pid" on stderr; PIDs on stdout with -v off.
    fuser "${port}/tcp" 2>/dev/null | tr -cs '0-9' '\n' | grep -E '^[0-9]+$' || true
  else
    ss -ltnp "sport = :${port}" 2>/dev/null \
      | grep -oE 'pid=[0-9]+' \
      | cut -d= -f2 \
      | sort -u || true
  fi
}

describe_port_holders() {
  local port="$1" pid cmd
  local pids
  pids="$(port_listener_pids "$port")"
  [[ -n "${pids}" ]] || return 1
  for pid in $pids; do
    cmd="$(ps -o cmd= -p "$pid" 2>/dev/null | sed 's/^[[:space:]]*//' || echo '?')"
    printf '  port %s: pid %s — %s\n' "$port" "$pid" "${cmd:-?}"
  done
  return 0
}

require_ports_free() {
  local port busy=0
  for port in "${DEV_PORTS[@]}"; do
    if describe_port_holders "$port"; then
      busy=1
    fi
  done
  if ((busy)); then
    echo "dev: listen port(s) already in use (stale producer/gateway/vite from a prior run?)." >&2
    echo "dev: kill those PIDs, then retry. Example:" >&2
    echo "  fuser -k ${PRODUCER_PORT}/tcp ${GATEWAY_PORT}/tcp ${DASHBOARD_PORT}/tcp" >&2
    exit 1
  fi
}

kill_leaf_servers() {
  local sig="${1:-TERM}" pat
  for pat in "${LEAF_PATTERNS[@]}"; do
    pkill "-${sig}" -f "$pat" 2>/dev/null || true
  done
}

signal_dev_ports() {
  local sig="$1" port pid
  for port in "${DEV_PORTS[@]}"; do
    if command -v fuser >/dev/null 2>&1; then
      fuser -k "-${sig}" "${port}/tcp" 2>/dev/null || true
      continue
    fi
    for pid in $(port_listener_pids "$port"); do
      kill "-${sig}" "$pid" 2>/dev/null || true
    done
  done
}

kill_serves() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      # Session leader from setsid — TERM the whole process group first.
      kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  # Reap leaf servers that escaped the process group (nx → bun/vite).
  kill_leaf_servers TERM
  signal_dev_ports TERM
  sleep 0.3
  for pid in "${PIDS[@]:-}"; do
    wait "$pid" 2>/dev/null || true
  done
  # Escalate anything still holding our ports / matching leaf cmdlines.
  kill_leaf_servers KILL
  signal_dev_ports KILL
}

on_signal() {
  kill_serves
  exit 0
}

trap on_signal INT TERM

bunx nx run infra:up

require_ports_free

start_serve() {
  local name="$1"
  # Own session so Ctrl+C / fail-fast can kill the whole serve + sed pipeline.
  setsid bash -c "set -o pipefail; bunx nx serve ${name} 2>&1 | sed -u \"s/^/[${name}] /\"" &
  PIDS+=($!)
}

start_serve producer
start_serve gateway
start_serve dashboard

# Fail-fast: non-zero exit from any serve tears down the rest.
while true; do
  alive=0
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      alive=1
      break
    fi
  done
  if ((alive == 0)); then
    break
  fi

  if wait -n; then
    continue
  fi
  status=$?
  kill_serves
  exit "$status"
done

exit 0
