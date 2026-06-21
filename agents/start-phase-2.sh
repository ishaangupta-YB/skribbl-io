#!/usr/bin/env bash
#
# Phase 2 — integration. One agent wires the Expo client to the real Worker/DO
# (wrangler dev), runs a multi-client end-to-end playthrough, and resolves any
# protocol drift. Run this AFTER Phase 1 branches are merged into `develop`.
#
# Usage:  ./start-phase-2.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

launch_phase "phase2" \
  "integration|phase-2-integration.md"
