#!/usr/bin/env bash
# Run Playwright. T15 requires zero specs to exit cleanly (no tests found = success).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

set +e
output="$(bunx playwright test --config=playwright.config.ts "$@" 2>&1)"
status=$?
set -e
printf '%s\n' "$output"

if [[ "$status" -eq 0 ]]; then
  exit 0
fi

if printf '%s\n' "$output" | grep -qiE 'no tests found|did not match any files'; then
  echo "e2e: no specs present (T15 foundation) — treating as success"
  exit 0
fi

exit "$status"
