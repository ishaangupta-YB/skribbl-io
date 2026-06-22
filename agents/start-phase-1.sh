#!/usr/bin/env bash
#
# Phase 1 — parallel build. Spins up 4 Devin agents in ONE tmux window:
#   a-backend  · Cloudflare Worker + Durable Object        (apps/api)
#   b-shell    · Expo app shell + design system            (apps/mobile)
#   c-canvas   · Skia canvas + realtime WS client          (features/canvas, lib/realtime)
#   d-game     · game flow screens                         (features/game)
#
# Each runs in its own git worktree/branch so they never collide.
# Usage:  ./start-phase-1.sh        (SKIP_INSTALL=1 ./start-phase-1.sh to skip pnpm install)
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

launch_phase "phase1" \
  "a-backend|agent-a-backend.md|glm-5.2" \
  "b-shell|agent-b-shell.md|glm-5.2" \
  "c-canvas|agent-c-canvas.md|kimi-k2.7" \
  "d-game|agent-d-game.md|kimi-k2.7"
