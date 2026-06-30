# AGENTS.md — multi-agent workflow

How parallel Devin/Claude agents collaborate on `skribbl-cloud` via **tmux + Devin CLI** without stepping on each other. Read this fully before starting.

> **Git model:** the git repository IS this `skribbl-cloud/` folder (the final app). **The human owns ALL git history** — agents NEVER commit, push, merge, or rebase (see “Commit & integration protocol”).

## Golden rules

1. **The contract is frozen.** `packages/shared` is the single source of truth. After Phase 0, only the **Orchestrator** edits it, and only via a documented change (see "Changing the contract"). Everyone else imports from `@skribbl/shared`.
2. **Stay in your lane.** Only edit files inside your ownership area (table below). Touching another agent's files requires a handoff note.
3. **One worktree per agent.** Use `git worktree` so each agent has an isolated working dir + branch. Never share a working dir.
4. **Update `TODO.md`** when you finish a task (check the box, add a one-line note).
5. **Write a handoff** in `docs/handoffs/` when your output unblocks another agent.
6. **Run `react-doctor`** after React changes: `npx -y react-doctor@latest . --verbose --diff` (fix errors, re-run).
7. **Typecheck + test before every checkpoint:** `pnpm typecheck && pnpm test`.
8. **You do NOT touch git.** Never run `git commit/push/merge/rebase`. When done (or at a milestone), print a **COMMIT CHECKPOINT** and STOP — the human reviews, commits, and re-launches you.

## Ownership matrix

| Agent | Role | Owns (editable) | Branch |
|---|---|---|---|
| **Orchestrator** | Integration, contract, reviews | `packages/shared/**`, root config, `docs/**`, `TODO.md` | `develop` |
| **A** | Backend / Durable Object | `apps/api/**` | `agent/a-backend` |
| **B** | App shell + design system | `apps/mobile/app/**`, `apps/mobile/components/**`, theme/config | `agent/b-shell` |
| **C** | Realtime canvas + WS client | `apps/mobile/features/canvas/**`, `apps/mobile/lib/realtime/**` | `agent/c-canvas` |
| **D** | Game flow screens | `apps/mobile/features/game/**` | `agent/d-game` |
| **V** | **Verifier / reviewer** (strict QA gate; reports only) | `docs/verification/**` (report files only) | `agent/verify` |

> **Orchestrator = you, the human.** You own `develop`, all merges, and every commit. Agents propose; you dispose.
> B owns the Expo scaffold and creates the shared folders (`features/`, `lib/`) on day 1 so C and D have a place to land. Coordinate that scaffold via `docs/handoffs/frontend-integration.md`.

## tmux layout

```
session: skribbl
┌──────────────┬──────────────┐
│ 0 orchestr.  │ 1 agent-A    │   wrangler dev (apps/api)
├──────────────┼──────────────┤
│ 2 agent-B    │ 3 agent-C    │   expo start (apps/mobile)
├──────────────┼──────────────┤
│ 4 agent-D    │ 5 services   │   pnpm mock + logs
└──────────────┴──────────────┘
```

Don't wire this by hand — the `agents/` scripts do it for you (worktrees live inside the repo at `.worktrees/<name>`, but are git-ignored):

```bash
# from skribbl-cloud/agents
./start-phase-1.sh     # a-backend, b-shell, c-canvas, d-game (parallel, one pane each)
./status.sh            # branches / worktrees / panes
./review.sh            # read-only: what each agent changed (review before YOU commit)
./verify.sh 1          # strict Verifier gate for a phase (after you merge it)
./stop.sh              # end the tmux session
```

Each agent starts with its `agents/prompts/*.md` role prompt: "You are Agent X. Read AGENTS.md + your handoff doc. Only edit files in your ownership area. Build against `@skribbl/shared` and the mock. Do NOT commit — print a CHECKPOINT and stop."

## Dependencies between agents

- **A, B, C, D** all depend on **Phase 0** (`@skribbl/shared` + mock). They can then run **in parallel**.
- **C** and **D** depend on **B**'s Expo scaffold (router + folders + theme). B should land a minimal scaffold first and post `frontend-integration.md`.
- **Integration (Phase 2)** depends on **A** (post `backend-ready.md`) + B/C/D reaching a playable state against the mock.
- Because agents don't commit, **you commit B's scaffold and merge it into `develop` first**, then C/D pick it up (from the repo root run `git -C .worktrees/<c|d> merge develop`, or just launch C/D after that merge).
- After you merge a phase into `develop`, run the **Verifier** (`./verify.sh <phase>`) before moving on.

## Develop against the mock, integrate against the DO

```bash
pnpm install && pnpm build      # build @skribbl/shared
pnpm mock                       # ws://localhost:8787/api/rooms/<ID>/ws
# point apps/mobile EXPO_PUBLIC_WS_URL at the mock during Phase 1,
# then at `wrangler dev` (apps/api) during Phase 2.
```

The mock implements the full protocol/game loop, so UI agents see realistic `room:state`, `turn:*`, `draw`, `chat`, `guess:correct`, and `game:over` messages.

## Changing the contract

If you need a protocol change:
1. Open an entry in `docs/handoffs/contract.md` describing the change + why.
2. Orchestrator edits `packages/shared`, bumps notes, runs `pnpm build && pnpm test`.
3. Orchestrator updates the **mock server** to match.
4. Affected agents pull `develop` and adapt. Never fork the schema locally.

## Commit & integration protocol (human-owned)

Agents NEVER touch git. The flow is:
1. An agent finishes (or hits a milestone), prints a **COMMIT CHECKPOINT** (summary, changed files, verification output, suggested commit message), then stops.
2. **You** review it (`./review.sh` shows each worktree's diff) and, if happy, commit IN THAT WORKTREE:
   - `git -C .worktrees/<agent> add -A`   *(paths here are relative to the repo root)*
   - `git -C .worktrees/<agent> commit -m "phaseN(<agent>): <summary>"`
3. Merge the branch into `develop` from the repo root: `git switch develop && git merge agent/<agent>`.
4. Resolve any contract drift yourself (you own `packages/shared`).
5. After a whole phase is merged, run `./verify.sh <phase>`; act on the report (re-launch an agent to fix, then re-verify).
6. Push when YOU decide: `git push -u origin develop` (merge to `main` for releases).

Each checkpoint must already pass `pnpm typecheck`, `pnpm test`, `pnpm lint`, and (for RN) `react-doctor` — that's the agent's job before it stops.

## Verification gate

- The **Verifier agent** (`agents/prompts/verifier.md`, launched by `./verify.sh <phase>`) is a strict, read-only QA gate. It re-runs the full suite + a multi-client playthrough, checks the phase Definition of Done and the anti-cheat invariants item-by-item, and writes `docs/verification/phase-<n>.md` with a PASS/FAIL verdict. It fixes nothing and commits nothing.
- Don't advance to the next phase until the Verifier says **PASS** (or you consciously accept the listed risks).

## Commands cheat-sheet

```bash
pnpm install          # install workspace
pnpm build            # build @skribbl/shared (run before mock/api/mobile)
pnpm test             # all package tests (shared contract suite)
pnpm typecheck        # workspace typecheck
pnpm lint             # eslint
pnpm mock             # local protocol mock server
pnpm --filter @skribbl/shared test:watch
```
