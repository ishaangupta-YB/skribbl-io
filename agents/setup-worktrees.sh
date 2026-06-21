#!/usr/bin/env bash
#
# Create the develop base branch (committing Phase 0) and one git worktree +
# branch per agent — WITHOUT launching tmux. The start-phase-*.sh scripts call
# this logic automatically, so you normally don't need to run this directly.
# Useful for pre-warming worktrees or re-creating them after cleanup.
#
# Usage:  ./setup-worktrees.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

preflight
ensure_base_branch

# All agent identities used across phases.
AGENTS=(a-backend b-shell c-canvas d-game integration lobby-d1 word-packs polish qa deploy)

for name in "${AGENTS[@]}"; do
  ensure_worktree "agent/$name" "$WORKTREE_ROOT/$name"
done

log "done. worktrees under: $WORKTREE_ROOT"
git -C "$REPO_ROOT" worktree list
