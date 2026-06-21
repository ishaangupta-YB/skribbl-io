#!/usr/bin/env bash
#
# Phase 3 — enhancements (parallel). 3 Devin agents in one tmux window:
#   lobby-d1    · public lobby browser backed by D1 + KV
#   word-packs  · custom word packs (host-created, stored in D1)
#   polish      · sounds, haptics, theming, animations, confetti, reactions
#
# Run AFTER Phase 2 (a playable end-to-end game on the real backend).
# Usage:  ./start-phase-3.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

launch_phase "phase3" \
  "lobby-d1|phase-3-lobby-d1.md" \
  "word-packs|phase-3-word-packs.md" \
  "polish|phase-3-polish.md"
