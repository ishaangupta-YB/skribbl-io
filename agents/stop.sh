#!/usr/bin/env bash
#
# Stop the agents. Kills the tmux session. Optionally removes worktrees.
#
# Usage:
#   ./stop.sh                # kill the tmux session only (worktrees + branches kept)
#   ./stop.sh --worktrees    # also remove all agent worktrees (branches kept)
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  tmux kill-session -t "$TMUX_SESSION"
  log "killed tmux session '$TMUX_SESSION'"
else
  log "no tmux session '$TMUX_SESSION' running"
fi

if [ "${1:-}" = "--worktrees" ] || [ "${1:-}" = "--all" ]; then
  for name in a-backend b-shell c-canvas d-game integration lobby-d1 word-packs polish qa deploy; do
    wt="$WORKTREE_ROOT/$name"
    if [ -d "$wt" ]; then
      if git -C "$REPO_ROOT" worktree remove --force "$wt" 2>/dev/null; then
        log "removed worktree: $name"
      else
        warn "could not remove worktree: $wt"
      fi
    fi
  done
  git -C "$REPO_ROOT" worktree prune
  log "worktrees pruned. (agent/* branches kept — delete with: git branch -D agent/<name>)"
else
  echo
  log "worktrees kept under: $WORKTREE_ROOT"
  log "remove them too with:  ./stop.sh --worktrees"
fi
