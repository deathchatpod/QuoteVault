#!/usr/bin/env bash
# ------------------------------------------------------------------
# run-e2e.sh – Run Playwright E2E tests inside Replit
#
# What this script does:
#   1. Figures out where Chromium lives (via nix-shell if needed).
#   2. Checks whether the dev server is already running on port 5000.
#      • If yes  → reuses it.
#      • If no   → starts it in the background and waits until ready.
#   3. Runs Playwright tests.
#   4. Cleans up the server it started (if any).
# ------------------------------------------------------------------
set -euo pipefail

PORT="${PORT:-5000}"
BASE_URL="http://localhost:${PORT}"
SERVER_PID=""

# ── Cleanup on exit ──────────────────────────────────────────────
cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    echo ""
    echo "Stopping dev server (PID ${SERVER_PID})..."
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── 1. Locate Chromium ──────────────────────────────────────────
if [[ -z "${CHROMIUM_PATH:-}" ]]; then
  # Try to find chromium already on PATH
  if command -v chromium &>/dev/null; then
    export CHROMIUM_PATH="$(command -v chromium)"
  else
    echo "System Chromium not found – resolving via nix-shell (one-time)..."
    CHROMIUM_PATH="$(nix-shell -p chromium --run 'which chromium' 2>/dev/null)" || {
      echo "ERROR: Could not locate Chromium via nix-shell."
      echo "       Make sure the Replit has the nodejs-20 + nix modules enabled."
      exit 1
    }
    export CHROMIUM_PATH
  fi
fi
echo "Using Chromium at: ${CHROMIUM_PATH}"

# ── 2. Server check / start ────────────────────────────────────
is_server_up() {
  curl -sf "${BASE_URL}" >/dev/null 2>&1
}

if is_server_up; then
  echo "Dev server already running at ${BASE_URL} – reusing it."
else
  echo "Dev server not detected – starting it in the background..."
  npm run dev &
  SERVER_PID=$!

  echo "Waiting for server to be ready on ${BASE_URL} ..."
  TRIES=0
  MAX_TRIES=60
  while ! is_server_up; do
    TRIES=$((TRIES + 1))
    if [[ ${TRIES} -ge ${MAX_TRIES} ]]; then
      echo "ERROR: Server did not start within ${MAX_TRIES} seconds."
      exit 1
    fi
    sleep 1
  done
  echo "Server is up after ~${TRIES}s."
fi

# ── 3. Run Playwright ──────────────────────────────────────────
echo ""
echo "Running Playwright tests..."
echo "─────────────────────────────────────────────────────────"
npx playwright test "$@"
EXIT_CODE=$?

# ── 4. Report ──────────────────────────────────────────────────
echo ""
if [[ ${EXIT_CODE} -eq 0 ]]; then
  echo "All tests passed!"
else
  echo "Some tests failed (exit code ${EXIT_CODE})."
  echo ""
  echo "Debug artifacts saved to:"
  echo "  • Screenshots & traces:  ./test-results/"
  echo "  • HTML report:           ./playwright-report/"
  echo ""
  echo "To view the HTML report run:  npx playwright show-report"
fi

exit ${EXIT_CODE}
