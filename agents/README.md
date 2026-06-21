# agents/ — parallel Devin agent launchers (tmux)

One command per phase spins up multiple **Devin CLI** agents in **one tmux window** (one pane each), each in its own isolated **git worktree/branch**, each running your chosen model headlessly with a tailored prompt.

```
agents/
├─ lib.sh               # ALL config + helpers (edit the DEVIN_* block here)
├─ start-phase-1.sh     # 4 agents: a-backend, b-shell, c-canvas, d-game   ← the big one
├─ start-phase-2.sh     # 1 agent : integration
├─ start-phase-3.sh     # 3 agents: lobby-d1, word-packs, polish
├─ start-phase-4.sh     # 2 agents: qa, deploy
├─ verify.sh            # strict Verifier/reviewer agent for a phase: ./verify.sh <n>
├─ review.sh            # READ-ONLY: show each worktree's diff so YOU can review before committing
├─ setup-worktrees.sh   # create branches+worktrees only (no tmux)
├─ stop.sh              # kill the tmux session (./stop.sh --worktrees to remove worktrees)
├─ status.sh            # show branches / worktrees / tmux panes
└─ prompts/             # one .md prompt per agent (incl. verifier.md), fed to devin
```

## 1. One-time: point the scripts at your Devin CLI

Open `agents/lib.sh` and edit the **DEVIN CLI CONFIG** block at the top. Defaults assume:

```bash
devin -p "<PROMPT TEXT>" --model claude-opus-4.8-max-fast
```

If your CLI differs, change these (they're the only Devin-specific bits):

| Variable | Meaning | Example values |
|---|---|---|
| `DEVIN_BIN` | the CLI executable | `devin` |
| `DEVIN_SUBCMD` | headless task subcommand | `""`, `run`, `task` |
| `DEVIN_MODEL` | **exact** model id | `claude-opus-4.8-max-fast` |
| `DEVIN_MODEL_FLAG` | model flag (or `""`) | `--model` |
| `DEVIN_PROMPT_MODE` | how the prompt is passed | `flag` \| `stdin` \| `file` |
| `DEVIN_PROMPT_FLAG` | flag for `flag` mode | `-p` |
| `DEVIN_PROMPT_FILE_FLAG` | flag for `file` mode | `--prompt-file` |

You can also override per run, e.g.: `DEVIN_MODEL=opus-x DEVIN_PROMPT_MODE=stdin ./start-phase-1.sh`.

Verify your exact flags with your CLI's help (e.g. `devin --help`, `devin models`). To preview the command without launching agents: `DEVIN_PROMPT_MODE=stdin bash -c 'source ./lib.sh; build_devin_cmd "$PWD/prompts/agent-a-backend.md" a-backend; echo'`.

## 2. Run a phase

```bash
cd skribbl-cloud/agents
./start-phase-1.sh
```

> **Prerequisite (one-time):** the git repo IS `skribbl-cloud/`, and **you make the first commit** — agents never commit. If you haven't yet:
> ```bash
> git -C .. add -A && git -C .. commit -m "chore: phase 0 foundation"
> ```

What it does automatically (it NEVER commits):
1. Ensures a `develop` branch ref exists (pointed at your last commit — it does NOT create a commit).
2. Creates `agent/<name>` branches + git worktrees under `../../skribbl-worktrees/<name>` (OUTSIDE the repo & workspace).
3. Runs `pnpm install && pnpm build` in each worktree (skip with `SKIP_INSTALL=1`).
4. Opens tmux session `skribbl`, one tiled pane per agent, and launches `devin` with that agent's prompt + model.
5. Attaches you to the window. Each agent works, prints a **COMMIT CHECKPOINT**, and stops — **you** commit (see §4).

## 3. Drive tmux (cheat-sheet)

- Detach (leave agents running): `Ctrl-b` then `d` → re-attach: `tmux attach -t skribbl`
- Switch pane: `Ctrl-b` then arrow key (mouse is enabled too — just click)
- Zoom a pane fullscreen / back: `Ctrl-b` then `z`
- Scroll a pane: `Ctrl-b` then `[` (q to exit scroll)

## 4. Between phases — YOU commit (agents don't)

Each agent prints a **COMMIT CHECKPOINT** and stops. You review, commit, merge, then verify:

```bash
./review.sh                                       # read-only: what each agent changed
# commit an agent's work (in ITS worktree):
git -C ../../skribbl-worktrees/a-backend add -A
git -C ../../skribbl-worktrees/a-backend commit -m "phase1(a-backend): DO + REST"
# merge it into develop (from the repo root = skribbl-cloud, i.e. `..` here):
git -C .. switch develop && git -C .. merge agent/a-backend
# ...repeat for each finished agent, then gate the phase:
./verify.sh 1                                     # strict QA → docs/verification/phase-1.md
./stop.sh                                         # end the phase-1 panes
./start-phase-2.sh                                # integration on the merged result
```

**B's scaffold goes first.** C and D need B's Expo scaffold. Let B reach its `scaffold-ready` checkpoint, commit + merge it into `develop`, then either launch C/D (they'll branch off the updated `develop`) or run `git -C ../../skribbl-worktrees/<c|d> merge develop`.

`./status.sh` shows where everything stands. `./stop.sh --worktrees` removes worktrees when fully done. **Push only when you decide:** `git -C .. push -u origin develop`.

## 5. Notes

- **You own git:** agents NEVER commit, push, merge, or rebase — and neither do these scripts. Agents print a COMMIT CHECKPOINT and stop; you commit/merge/push (§4).
- **Isolation:** each agent edits files in its own worktree, so parallel work never collides. Ownership boundaries are enforced by the prompts + `AGENTS.md`.
- **Model:** every agent uses `DEVIN_MODEL` (set once in `lib.sh`).
- **Re-runs are safe:** existing branches/worktrees are reused, not recreated.
- **Requirements:** `git`, `tmux` (`brew install tmux`), `pnpm` (`corepack enable`), and your `devin` CLI on `PATH`.
