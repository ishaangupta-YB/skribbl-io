#!/usr/bin/env bash
#
# READ-ONLY review helper. Shows each agent worktree's branch + uncommitted
# changes + a diffstat vs the base branch, so YOU can review before committing.
# This script never commits, pushes, or modifies anything.
#
# Usage:  ./review.sh
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=lib.sh
source ./lib.sh

ALL=(a-backend b-shell c-canvas d-game integration lobby-d1 word-packs polish qa deploy verify)

found=0
for name in "${ALL[@]}"; do
  wt="$WORKTREE_ROOT/$name"
  [ -d "$wt" ] || continue
  found=1
  echo "──────────────── $name ────────────────"
  echo "path   : $wt"
  echo "branch : $(git -C "$wt" symbolic-ref --short HEAD 2>/dev/null || echo '?')"
  n="$(git -C "$wt" status --porcelain | wc -l | tr -d ' ')"
  echo "uncommitted: $n file(s)"
  git -C "$wt" status --short | head -25
  echo "diffstat vs $BASE_BRANCH:"
  git -C "$wt" diff --stat "$BASE_BRANCH"...HEAD 2>/dev/null | tail -20 || true
  echo
done

[ "$found" = "1" ] || { log "no worktrees yet under $WORKTREE_ROOT — run ./start-phase-1.sh first"; exit 0; }

log "YOU own commits. Typical flow per agent when its CHECKPOINT prints:"
echo "  git -C \"$WORKTREE_ROOT/<agent>\" add -A"
echo "  git -C \"$WORKTREE_ROOT/<agent>\" commit -m \"phaseN(<agent>): <summary>\""
log "then merge a finished agent branch into develop:"
echo "  git -C \"$REPO_ROOT\" switch develop && git -C \"$REPO_ROOT\" merge agent/<agent>"
log "after merging a whole phase, verify it strictly:  ./verify.sh <phase>"
