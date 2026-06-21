#!/usr/bin/env bash
#
# Strict per-phase verification. Launches ONE Verifier/Reviewer agent in its own
# worktree off `develop`. It runs the full gate (typecheck/test/lint/react-doctor
# + a multi-client playthrough), checks the phase Definition of Done + anti-cheat
# invariants, and writes docs/verification/phase-<n>.md with a PASS/FAIL verdict.
# It does NOT fix code and does NOT commit.
#
# Run AFTER you've merged that phase's agent branches into `develop`.
#
# Usage:  ./verify.sh <phase>        e.g.  ./verify.sh 1
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# use a separate tmux session so it can run even if a phase session is alive
export TMUX_SESSION="skribbl-verify"
# shellcheck source=lib.sh
source ./lib.sh

phase="${1:-}"
[ -n "$phase" ] || die "usage: ./verify.sh <phase>   e.g. ./verify.sh 1"

# build a per-run prompt that injects the target phase at the top of verifier.md.
# Kept INSIDE the repo in a git-ignored dir, so nothing is created outside the root.
mkdir -p "$AGENTS_DIR/.run"
runprompt="$AGENTS_DIR/.run/verify-p$phase.md"
{
  echo "## TARGET PHASE: $phase  — strictly verify ONLY what Phase $phase was supposed to deliver."
  echo
  cat "$PROMPTS_DIR/verifier.md"
} > "$runprompt"

log "launching strict Verifier for Phase $phase (worktree branch: agent/verify)"
launch_phase "verify-p$phase" "verify|$runprompt"
