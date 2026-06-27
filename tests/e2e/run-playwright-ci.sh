#!/usr/bin/env bash
#
# CI helper for the Playwright web E2E.
# Builds the static web client, boots wrangler dev, serves the client, and runs
# Playwright against both. Cleans up background processes on exit.
#
# Usage (from repo root):
#   EXPO_PUBLIC_WS_URL=ws://localhost:8787 ./tests/e2e/run-playwright-ci.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
WEB_DIR="$REPO_ROOT/apps/mobile"
WEB_DIST="$WEB_DIR/dist"
PORT=8787
WEB_PORT=8081

export EXPO_PUBLIC_WS_URL="${EXPO_PUBLIC_WS_URL:-ws://localhost:$PORT}"

# ---- CORS override for local Playwright browser (http://localhost:8081) ----
# wrangler.toml hardcodes the production origin; we inject a temporary .dev.vars
# so the CI web server can call the local API without CORS blocking POST.
DEV_VARS="$API_DIR/.dev.vars"
PROD_ORIGINS="https://skribbl-io.pages.dev"
DEV_VARS_ORIGINS="${DEV_VARS_ORIGINS:-$PROD_ORIGINS,http://localhost:$WEB_PORT}"

# ---- cleanup ----
pids=()
cleanup() {
  for p in "${pids[@]}"; do
    kill "$p" 2>/dev/null || true
  done
  rm -f "$DEV_VARS"
}
trap cleanup EXIT

# Write the temporary vars override before wrangler dev starts.
echo "ALLOWED_ORIGINS = \"$DEV_VARS_ORIGINS\"" > "$DEV_VARS"

# ---- build shared + web client ----
echo "[playwright-ci] building shared + web client"
cd "$REPO_ROOT"
pnpm build

rm -rf "$WEB_DIST"
cd "$WEB_DIR"
pnpm export:web

# ---- start wrangler dev ----
echo "[playwright-ci] starting wrangler dev on :$PORT"
cd "$API_DIR"
wrangler_bin="$(pnpm exec which wrangler 2>/dev/null || echo npx wrangler)"
$wrangler_bin dev --port "$PORT" >/tmp/wrangler-playwright.log 2>&1 &
pids+=("$!")

# ---- start static web server ----
echo "[playwright-ci] serving web client on :$WEB_PORT"
cd "$REPO_ROOT"
pnpm exec serve -s "$WEB_DIST" -l "$WEB_PORT" >/tmp/serve-playwright.log 2>&1 &
pids+=("$!")

# ---- wait for health ----
echo "[playwright-ci] waiting for services"
wait_for() {
  local url="$1" deadline="$2"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  return 1
}

deadline="$(($(date +%s) + 120))"
wait_for "http://localhost:$PORT/health" "$deadline" || { cat /tmp/wrangler-playwright.log; exit 1; }
deadline="$(($(date +%s) + 60))"
wait_for "http://localhost:$WEB_PORT" "$deadline" || { cat /tmp/serve-playwright.log; exit 1; }

# ---- install playwright + run tests ----
echo "[playwright-ci] installing chromium"
cd "$REPO_ROOT/tests"
pnpm exec playwright install --with-deps chromium

echo "[playwright-ci] running playwright tests"
export EXPO_PUBLIC_WEB_URL="http://localhost:$WEB_PORT"
export EXPO_PUBLIC_API_URL="http://localhost:$PORT"
pnpm exec playwright test --config e2e/playwright.config.ts
