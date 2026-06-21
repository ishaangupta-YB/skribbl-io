#!/usr/bin/env bash
#
# Show the state of the multi-agent setup: branches, worktrees, tmux panes.
#
# Usage:  ./status.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

log "repo        : $REPO_ROOT"
log "current br. : $(git -C "$REPO_ROOT" symbolic-ref --short HEAD 2>/dev/null || echo '(detached)')"
log "base branch : $BASE_BRANCH"
log "worktrees   : $WORKTREE_ROOT"
echo
log "git worktrees:"
git -C "$REPO_ROOT" worktree list || true
echo
log "agent branches:"
git -C "$REPO_ROOT" for-each-ref --format='  %(refname:short)  →  %(objectname:short)  %(contents:subject)' refs/heads/agent 2>/dev/null || echo "  (none yet)"
echo
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  log "tmux '$TMUX_SESSION' is RUNNING — attach: tmux attach -t $TMUX_SESSION"
  tmux list-panes -s -t "$TMUX_SESSION" -F '  #{window_name}.#{pane_index}  title=#{pane_title}  cmd=#{pane_current_command}' || true
else
  log "tmux '$TMUX_SESSION' is not running. Start with: ./start-phase-1.sh"
fi
