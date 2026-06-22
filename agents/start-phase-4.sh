#!/usr/bin/env bash
#
# Phase 4 — hardening & deploy (parallel). 2 Devin agents in one tmux window:
#   qa      · tests (Vitest + RN + Playwright), edge cases, rate limiting, react-doctor
#   deploy  · wrangler deploy (Worker+DO+D1+KV), Cloudflare Pages (web), EAS (mobile), CI
#
# Usage:  ./start-phase-4.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

launch_phase "phase4" \
  "qa|phase-4-qa.md|glm-5.2" \
  "deploy|phase-4-deploy.md|kimi-k2.7"
