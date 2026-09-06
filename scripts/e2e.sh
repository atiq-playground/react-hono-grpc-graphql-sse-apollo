#!/usr/bin/env bash
# Run Playwright. T15 requires zero specs to exit cleanly (no tests found = success).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Minimal WSL / no-sudo hosts often lack Chromium system libs (libnspr4, libnss3,
# libasound). Prefer an extracted tree under .cache or the T32 /tmp workaround
# so `bunx nx e2e dashboard` does not fail at browser launch in ~1ms.
playwright_lib_dir() {
  local candidates=(
    "${PLAYWRIGHT_LIBS_DIR:-}"
    "$ROOT/.cache/playwright-libs/usr/lib/x86_64-linux-gnu"
    "/tmp/t32-playwright-libs/root/usr/lib/x86_64-linux-gnu"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -f "$candidate/libnspr4.so" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

ensure_playwright_libs() {
  local libdir
  if libdir="$(playwright_lib_dir)"; then
    printf '%s\n' "$libdir"
    return 0
  fi

  # Rebuild .cache from previously downloaded debs when present (no sudo).
  local deb_dir="/tmp/t32-playwright-libs/debs"
  local extract_root="$ROOT/.cache/playwright-libs"
  if [[ -d "$deb_dir" ]] && compgen -G "$deb_dir"/*.deb >/dev/null; then
    mkdir -p "$extract_root"
    local deb
    for deb in "$deb_dir"/*.deb; do
      dpkg-deb -x "$deb" "$extract_root"
    done
    if libdir="$(playwright_lib_dir)"; then
      printf '%s\n' "$libdir"
      return 0
    fi
  fi

  return 1
}

if LIB_DIR="$(ensure_playwright_libs)"; then
  export LD_LIBRARY_PATH="${LIB_DIR}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

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

if printf '%s\n' "$output" | grep -q 'libnspr4.so: cannot open shared object file'; then
  cat <<'EOF' >&2
e2e: Chromium could not load libnspr4.so (host missing Playwright system libs).

Prefer (needs sudo):
  sudo bunx playwright install-deps chromium

Or, without sudo, extract Ubuntu packages into .cache/playwright-libs and re-run:
  mkdir -p .cache/playwright-libs /tmp/t32-playwright-libs/debs
  (cd /tmp/t32-playwright-libs/debs && apt-get download libnspr4 libnss3 libasound2t64)
  for deb in /tmp/t32-playwright-libs/debs/*.deb; do dpkg-deb -x "$deb" .cache/playwright-libs; done
EOF
fi

exit "$status"
