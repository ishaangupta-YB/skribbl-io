#!/usr/bin/env bash
#
# Shared config + helpers for the skribbl-cloud multi-agent launchers.
# Sourced by start-phase-*.sh, setup-worktrees.sh, stop.sh, status.sh.
#
# It does three things:
#   1) ensures a `develop` base branch REF exists (it NEVER commits — you own git),
#   2) creates one isolated git worktree + branch per agent (inside .worktrees/),
#   3) opens ONE tmux window with one pane per agent, each running the
#      Devin CLI headlessly with that agent's prompt + model.
#
# Everything it creates (worktrees, run artifacts) stays INSIDE this repo and is
# git-ignored — nothing is written outside the repo root.
#
set -euo pipefail

# ============================================================================
# DEVIN CLI CONFIG  — EDIT THESE to match your `devin` CLI exactly.
# Everything Devin-specific is in this block. Override per-run via env vars too,
# e.g.  DEVIN_MODEL=my-model ./start-phase-1.sh
# ============================================================================
: "${DEVIN_BIN:=devin}"                         # the CLI executable on your PATH
: "${DEVIN_SUBCMD:=}"                            # subcommand for a headless task: "" | "run" | "task"
: "${DEVIN_MODEL:=glm-5.2}"                     # <-- DEFAULT model id (fallback). Per-agent overrides via the
                                                #     third field in launch_phase entries: "name|prompt.md|model-id".
                                                #     Available models (verified): glm-5.2, kimi-k2.7
: "${DEVIN_MODEL_FLAG:=--model}"                # flag to select the model ("" if you set it via devin config)
: "${DEVIN_PROMPT_MODE:=file}"                  # how the prompt is passed: flag | stdin | file
                                                #   file = `devin --prompt-file <path>` (NO -p) => INTERACTIVE: devin opens its
                                                #          TUI seeded with the prompt and you APPROVE each edit/exec request.
                                                #   flag = `devin -p "<text>"`            => non-interactive (print response & exit).
: "${DEVIN_PROMPT_FLAG:=-p}"                     # used when DEVIN_PROMPT_MODE=flag   ->  devin -p "<prompt text>"
: "${DEVIN_PROMPT_FILE_FLAG:=--prompt-file}"     # used when DEVIN_PROMPT_MODE=file   ->  devin --prompt-file <path>
# (stdin mode runs:  devin <SUBCMD> --model <MODEL> < <prompt-file> )
# Permission mode: left EMPTY so devin uses its built-in default ("auto"), which
# PROMPTS YOU to approve every edit/exec tool — you stay in control of all writes.
# (Set "dangerous" only for UNATTENDED runs where agents auto-approve ALL tools.)
: "${DEVIN_PERMISSION_MODE:=}"                   # ""(devin default: prompts you) | auto | dangerous
: "${DEVIN_PERMISSION_FLAG:=--permission-mode}"  # flag to set it ("" to omit)

# ============================================================================
# tmux / git config (override via env if you like)
# ============================================================================
: "${TMUX_SESSION:=skribbl}"        # tmux session name
: "${BASE_BRANCH:=develop}"         # integration branch the agent branches fork from
: "${SKIP_INSTALL:=0}"              # set 1 to skip `pnpm install && pnpm build` per worktree

# ---- derived paths (NO git calls here, so this file sources cleanly) ----
# The git repo IS skribbl-cloud itself (the final app). The parent folder is kept
# only as read-only reference to the original Flutter project.
AGENTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$AGENTS_DIR/prompts"
REPO_ROOT="$(cd "$AGENTS_DIR/.." && pwd)"             # .../skribbl-cloud  (the git repo root)
: "${WORKTREE_ROOT:=$REPO_ROOT/.worktrees}"            # git worktrees live INSIDE the repo, but are git-ignored (.gitignore)

# ---- pretty logging ----
log()  { printf '\033[1;36m[agents]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[agents:warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[agents:err]\033[0m %s\n' "$*" >&2; exit 1; }

# ---- preflight checks ----
preflight() {
  command -v git  >/dev/null 2>&1 || die "git not found"
  command -v tmux >/dev/null 2>&1 || die "tmux not found — install with: brew install tmux"
  command -v pnpm >/dev/null 2>&1 || warn "pnpm not found — agents need it (corepack enable && corepack prepare pnpm@9.12.3 --activate)"
  command -v "$DEVIN_BIN" >/dev/null 2>&1 || warn "'$DEVIN_BIN' not on PATH — edit DEVIN_BIN at the top of agents/lib.sh"
  [ -f "$REPO_ROOT/package.json" ] || die "missing $REPO_ROOT/package.json — is this the skribbl-cloud repo?"
}

# ---- ensure REPO_ROOT is a git repo (init one if needed; required for worktrees) ----
ensure_git_repo() {
  if git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  log "no git repo at $REPO_ROOT — running 'git init' (required for the agent worktree workflow)"
  git -C "$REPO_ROOT" init -q
  # make sure commits won't fail if the user has no global identity
  git -C "$REPO_ROOT" config user.name  >/dev/null 2>&1 || git -C "$REPO_ROOT" config user.name  "skribbl-agents"
  git -C "$REPO_ROOT" config user.email >/dev/null 2>&1 || git -C "$REPO_ROOT" config user.email "agents@skribbl.local"
}

# ---- ensure the develop base branch exists. NEVER commits (the human owns git). ----
ensure_base_branch() {
  ensure_git_repo
  # worktrees branch from a commit, so an initial commit must exist. We do NOT
  # create it — you control all commits.
  if ! git -C "$REPO_ROOT" rev-parse HEAD >/dev/null 2>&1; then
    die "No commit yet in $REPO_ROOT.
  You own all commits, so make the first one yourself, then re-run:
      git -C \"$REPO_ROOT\" add -A
      git -C \"$REPO_ROOT\" commit -m \"chore: phase 0 foundation\""
  fi
  # create the base branch REF only (this is not a commit) if it is missing
  if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
    log "creating base branch '$BASE_BRANCH' (branch ref only — no commit made)"
    git -C "$REPO_ROOT" branch "$BASE_BRANCH"
  fi
  if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
    warn "you have uncommitted changes — agents branch from '$BASE_BRANCH' @ its last commit,"
    warn "so uncommitted work is NOT included. Commit it yourself first if it should be."
  fi
  log "base branch '$BASE_BRANCH' ready @ $(git -C "$REPO_ROOT" rev-parse --short "$BASE_BRANCH" 2>/dev/null || echo '?')"
}

# ---- ensure a worktree exists for an agent branch ----
# usage: ensure_worktree <branch> <worktree_path>
ensure_worktree() {
  local branch="$1" path="$2"
  if git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree /{print $2}' | grep -Fxq "$path"; then
    log "worktree exists: $path"
  else
    if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
      log "creating branch '$branch' off '$BASE_BRANCH'"
      git -C "$REPO_ROOT" branch "$branch" "$BASE_BRANCH"
    fi
    log "adding worktree: $path  ($branch)"
    mkdir -p "$(dirname "$path")"
    git -C "$REPO_ROOT" worktree add "$path" "$branch" >/dev/null
  fi
  if [ "$SKIP_INSTALL" != "1" ] && [ -f "$path/package.json" ]; then
    log "  installing deps + building @skribbl/shared in $(basename "$path") (SKIP_INSTALL=1 to skip)"
    ( cd "$path" && pnpm install >/dev/null 2>&1 && pnpm build >/dev/null 2>&1 ) \
      || warn "  pnpm install/build failed in $path — the agent can re-run it"
  fi
}

# ---- build the shell command that launches one Devin agent in a pane ----
# usage: build_devin_cmd <prompt_file> <agent_label> [model]
#   model: optional per-agent model id; falls back to DEVIN_MODEL if empty/unset.
build_devin_cmd() {
  local prompt_file="$1" label="$2" model="${3:-}"
  : "${model:=$DEVIN_MODEL}"
  local model_part=""
  if [ -n "$DEVIN_MODEL_FLAG" ] && [ -n "$model" ]; then
    model_part="$DEVIN_MODEL_FLAG $model"
  fi
  local perm_part=""
  if [ -n "$DEVIN_PERMISSION_FLAG" ] && [ -n "$DEVIN_PERMISSION_MODE" ]; then
    perm_part="$DEVIN_PERMISSION_FLAG $DEVIN_PERMISSION_MODE"
  fi
  local flags="$model_part $perm_part"
  local invoke
  case "$DEVIN_PROMPT_MODE" in
    stdin) invoke="$DEVIN_BIN $DEVIN_SUBCMD $flags < '$prompt_file'" ;;
    file)  invoke="$DEVIN_BIN $DEVIN_SUBCMD $flags $DEVIN_PROMPT_FILE_FLAG '$prompt_file'" ;;
    *)     invoke="$DEVIN_BIN $DEVIN_SUBCMD $flags $DEVIN_PROMPT_FLAG \"\$(cat '$prompt_file')\"" ;;
  esac
  local header="echo '────────────────────────────────────────────'; echo ' agent : $label'; echo ' model : $model'; echo ' perms : ${DEVIN_PERMISSION_MODE:-<devin default>}'; echo ' prompt: $prompt_file'; echo ' dir   : '\$(pwd); echo '────────────────────────────────────────────'"
  local footer="rc=\$?; echo; echo \"[agent '$label' exited (code \$rc) — shell kept open; re-run: \$(fc -ln -1 2>/dev/null)]\"; exec \$SHELL"
  printf '%s; %s; %s' "$header" "$invoke" "$footer"
}

# ---- launch one tmux window with one pane per agent ----
# usage: launch_phase <window_name> "name|prompt_basename[|model]" ...
#   Each entry: "name|promptfile" or "name|promptfile|model-id"
#   The optional third field overrides DEVIN_MODEL for that agent.
launch_phase() {
  local window="$1"; shift
  [ "$#" -gt 0 ] || die "launch_phase: no agents given"

  preflight
  ensure_base_branch

  local names=() prompts=() dirs=() models=()
  local entry name promptfile model prompt branch wt
  for entry in "$@"; do
    IFS='|' read -r name promptfile model <<< "$entry"
    case "$promptfile" in
      /*) prompt="$promptfile" ;;
      *)  prompt="$PROMPTS_DIR/$promptfile" ;;
    esac
    [ -f "$prompt" ] || die "missing prompt file: $prompt"
    branch="agent/$name"
    wt="$WORKTREE_ROOT/$name"
    ensure_worktree "$branch" "$wt"
    names+=("$name"); prompts+=("$prompt"); dirs+=("$wt"); models+=("${model:-}")
  done

  if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    die "tmux session '$TMUX_SESSION' already exists.  attach: tmux attach -t $TMUX_SESSION   |   reset: $AGENTS_DIR/stop.sh"
  fi

  local pane_ids=() i
  for i in "${!names[@]}"; do
    if [ "$i" -eq 0 ]; then
      tmux new-session -d -s "$TMUX_SESSION" -n "$window" -c "${dirs[$i]}" -x 250 -y 60
      pane_ids+=("$(tmux display-message -p -t "$TMUX_SESSION:$window" '#{pane_id}')")
    else
      pane_ids+=("$(tmux split-window -P -F '#{pane_id}' -t "$TMUX_SESSION:$window" -c "${dirs[$i]}")")
      tmux select-layout -t "$TMUX_SESSION:$window" tiled >/dev/null
    fi
  done

  # cosmetics: titled pane borders + mouse
  tmux set-option -t "$TMUX_SESSION" pane-border-status top  >/dev/null 2>&1 || true
  tmux set-option -t "$TMUX_SESSION" pane-border-format ' #P · #{pane_title} ' >/dev/null 2>&1 || true
  tmux set-option -t "$TMUX_SESSION" mouse on >/dev/null 2>&1 || true

  for i in "${!names[@]}"; do
    tmux select-pane -t "${pane_ids[$i]}" -T "${names[$i]}"
    local cmd; cmd="$(build_devin_cmd "${prompts[$i]}" "${names[$i]}" "${models[$i]}")"
    tmux send-keys -t "${pane_ids[$i]}" "$cmd" C-m
  done

  tmux select-layout -t "$TMUX_SESSION:$window" tiled >/dev/null
  tmux select-pane -t "${pane_ids[0]}"

  log "launched ${#names[@]} agents in tmux '$TMUX_SESSION' (window '$window'): ${names[*]}"
  if [ -n "${TMUX:-}" ]; then
    warn "you're already inside tmux — switch with:  tmux switch-client -t $TMUX_SESSION"
  else
    tmux attach -t "$TMUX_SESSION"
  fi
}
