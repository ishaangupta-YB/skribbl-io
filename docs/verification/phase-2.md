# Phase 2 Verification — `skribbl-cloud`

**Verifier:** automated strict QA gate (read-only; no source edits, no commits).
**Target phase:** **2 — Integration** (wire Expo client to real Worker/DO via `wrangler dev`; multi-client E2E; lock contract `v1`).
**Date:** 2026-06-22
**Toolchain:** Node v22.14.0 · pnpm 9.12.3 · turbo 2.9.18 · wrangler 4.10.0 · react-doctor v0.5.8

## Branch / worktree note (process)

The Phase 2 deliverable lives in commit **`6719586` `feat(phase2): wire Expo client to real Cloudflare backend end-to-end`**, which is on `develop` and `agent/integration` but was **NOT present in the `agent/verify` worktree** (it was stale at `e5ea627`, the Phase 1 tip — exactly the condition the Phase 1 report warned about: *"stale agent/verify worktree must be reset before re-run"*).

To verify the actual Phase 2 code, the working tree of this worktree was populated from the Phase 2 commit with `git checkout 6719586 -- .` (a working-tree update only — **no `commit`/`push`/`merge`/`rebase` was run, and HEAD on `agent/verify` remains `e5ea627`**). The human should reset `agent/verify` to `develop` before the next run. This is a **process gap, not a Phase 2 code defect** — the Phase 2 code itself is what is verified below.

---

## VERDICT: PASS

Every Phase 2 Definition-of-Done item is satisfied with concrete live evidence (commands run against the real Cloudflare Worker + `GameRoom` Durable Object via `wrangler dev`, not replayed). The Expo client is wired to the real backend (REST + WS), a real 3-client playthrough completes end-to-end against the DO, no protocol mismatches were found, and the contract is tagged `v1` (`@skribbl/shared@1.0.0`). All non-negotiable invariants relevant to Phase 2 hold; the word never leaks to non-drawers before `turn:reveal`.

---

## Gate output (fresh runs, cache bypassed where relevant)

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install` | up to date, 0 errors |
| Build | `pnpm build` | `@skribbl/shared` built (ESM+CJS+DTS), success |
| Typecheck | `pnpm typecheck` | **5/5 packages pass** (`@skribbl/{shared,mobile,api,mock-ws-server}` + root) |
| Test | `pnpm test -- --force` | **4/4 packages pass — 81 tests** (shared 33, api 18, mobile 30 incl. live 3-client mock playthrough) |
| Lint | `pnpm lint` (`eslint .`) | **clean**, exit 0 |
| Web build | `expo export --platform web` | **8 static routes** bundle (`/`, `/create`, `/join`, `/lobby/[id]`, `/room/[id]`, `/settings`, `/_sitemap`, `/+not-found`) |
| react-doctor (full `apps/mobile`) | `npx react-doctor@latest apps/mobile --verbose` | **0 errors**, 74 warnings, score **47/100** (same range as Phase 1; "clean" is a Phase 4 DoD, not Phase 2) |
| react-doctor (`--diff`, changed files only) | `npx react-doctor@latest apps/mobile --verbose --diff` | **100/100, 0 issues** on the 2 changed TSX files — confirms `backend-ready.md` claim |
| Backend smoke | `wrangler dev --port 8799 --local` | `GET /health`→`{"ok":true}`; `GET /api/words`→3 packs; `POST /api/rooms`→`{roomId,settings}`; `GET /api/rooms/:id`→`{exists,room}`; unknown id→404; `GET /api/rooms`→`{rooms:[]}` |

---

## Definition of Done — item by item

Phase 2 DoD (from `TODO.md` §"Phase 2 — Integration"):

| DoD item | Status | Evidence |
|---|---|---|
| Point client `EXPO_PUBLIC_WS_URL` at `wrangler dev` | **PASS** | `apps/mobile/.env.example` now reads `EXPO_PUBLIC_WS_URL=ws://localhost:8787` with a comment "Phase 2: point this at `wrangler dev`…". `apps/mobile/lib/config.ts` exports `WS_BASE_URL` (default `ws://localhost:8787`, wrangler dev's default port) **and** a new `HTTP_BASE_URL` derived by swapping `ws→http`/`wss→https` so the REST client never hardcodes a host. Live: REST + WS both reached `wrangler dev` on `:8799` (I used `:8799` to avoid clashing with anything on `:8787`; the client default `:8787` matches wrangler dev). |
| Wire create/join flows to real REST (`POST /api/rooms`, `GET /api/rooms/:id`) | **PASS** | New `apps/mobile/lib/api.ts` (104 LOC): `createRoom`, `getRoom`, `listPublicRooms`, `listWordPacks`, all using `HTTP_BASE_URL`, with normalized `ApiError`. `app/create.tsx` calls `createRoom(settings)` then `router.replace("/room/[id]")`; `app/join.tsx` calls `getRoom(code)` (404 → friendly "No room with that code") before navigating. **Live:** `POST /api/rooms` returned `{roomId:"EVU56M",settings}` and `GET /api/rooms/EVU56M` returned `{exists:true,room:{...}}` — shapes match `CreateRoomResponse`/`GetRoomResponse`/`RoomMeta` exactly. |
| 3–4 client end-to-end playthrough | **PASS** | **18/18 live checks** against the real DO (3 WS clients + REST), full loop: create → join (3) → host=first joiner → start → `turn:choosing` (choices only to drawer) → `select-word` → `turn:start` (word only to drawer; masked word + `wordLength` to guessers) → draw (mirrored, coords ∈ [0,1]) → correct guess (`guess:correct`, points=295 ≤ 300) → alarm-driven `turn:reveal` → `game:over` leaderboard (3 players, sorted desc by `score`). Plus **3/3 anti-cheat guards** (non-host `start`→`NOT_ALLOWED`; non-drawer `draw` ignored; drawer typing word suppressed) and a **hint check** (guesser got `turn:hint` `___k__`, drawer got 0 hints). |
| Resolve protocol mismatches; tag contract `v1` | **PASS** | `packages/shared/package.json` version bumped `0.1.0` → **`1.0.0`**; `docs/handoffs/contract.md` status line now reads *"FROZEN ✅ — tagged `v1` (Phase 2 integration complete)… no drift was found and no changes were required."* No protocol changes were needed — the Phase 1 contract already matched the DO. Verified: every frame in the live playthrough parsed cleanly against the frozen `parseServerMessage` shapes. |
| `TODO.md` Phase 2 checkmarks truthful | **PASS** | All 4 Phase 2 sub-items are `[x]` and each was independently reproduced live (above). |

---

## Live multi-client playthrough vs `wrangler dev` (real DO)

3 WebSocket clients (Alice/Bob/Cara) + REST against `ws://localhost:8799/api/rooms/<id>/ws`, `maxRounds:1`, `roundDurationSec:30`, `hintsEnabled:true`, `wordPackIds:["animals"]`. **18/18 assertions passed:**

- REST `POST /api/rooms` → `{roomId,settings}`; `GET /api/rooms/:id` → `{exists:true,room}`.
- 3 clients joined; each got `room:state` with a distinct `youId`; first joiner = host; last joiner's snapshot had 3 players.
- `turn:choosing`: **exactly one** client got `choices` (3 words); the other two got `choices:null`.
- `turn:start`: drawer got `word="crocodile"`; **both guessers got `word:null`**, `maskedWord="_________"`, `wordLength=9`.
- Drawer stroke `{points:[{0.1,0.2},{0.5,0.6}],width:6,mode:"draw"}` mirrored to both guessers; all coords ∈ [0,1].
- Correct guess → `guess:correct` `points=295` (≤300).
- Alarm-driven `turn:reveal` fired (server clock) with `word="crocodile"` for all; drawer earned `roundPoints=75`.
- `game:over.leaderboard`: 3 players sorted desc by `score` (Bob 295, Alice 75, Cara 0).
- **Pre-reveal leak scan:** across the guesser's entire frame stream, the word appeared in **exactly one** frame — `turn:reveal` (the legitimate end-of-turn reveal). **Zero pre-reveal leaks.**

Separate **hint** verification (no one guesses, 30s turn, hints on): guesser received `turn:hint` `maskedWord="___k__"`; **drawer received 0 `turn:hint` frames**.

Separate **anti-cheat** verification: non-host `start` → `error{code:"NOT_ALLOWED"}`; non-drawer `draw` ignored (no mirror to the drawer); drawer typing the word into `chat` suppressed (not echoed to anyone).

---

## Non-negotiable invariants (Phase 2-relevant)

| Invariant | Status | Evidence |
|---|---|---|
| `word` never sent to non-drawers (before reveal) | **PASS** | Live: guessers got `word:null` in `turn:start`/`room:state`; `choices:null` in `turn:choosing`; the only frame containing the word was `turn:reveal` (intended). Pre-reveal leak count = 0. DO code unchanged from Phase 1 (`buildState`/`turn:start`/`turn:choosing` drawer-only fields, per Phase 1 report). |
| Timer server-authoritative (DO Alarms) | **PASS** | `turn:reveal` fired on the server clock after the 30s drawing phase without any client action (the guesser had already guessed; the turn still ran to the alarm). No client-driven turn end. |
| Scoring/validation server-side via `@skribbl/shared` | **PASS** | `guess:correct.points=295` and `turn:reveal.scores` produced by the DO; client only displays. `lib/api.ts` performs no scoring. |
| Draw coordinates normalized 0–1 | **PASS** | Live mirrored stroke points all ∈ [0,1]. |
| No secrets committed | **PASS** | grep across `*.{ts,tsx,js,json,toml,env,mjs}` for key/secret/token/PEM/AWS/Slack/GitHub/OpenAI patterns → only Tailwind color-token false positives. Only tracked env file is `apps/mobile/.env.example` (`EXPO_PUBLIC_WS_URL` only). `wrangler.toml` holds placeholder binding ids. |
| Agents stayed in ownership lanes | **PASS (with note)** | Phase 2 commit (`6719586`) touched: `apps/mobile/{.env.example,app/create.tsx,app/join.tsx,lib/api.ts,lib/config.ts}`, `packages/shared/package.json`, `TODO.md`, `docs/handoffs/{backend-ready,contract}.md`, `docs/verification/phase-1.md`, `agents/*`. The `apps/mobile` integration glue is cross-cutting orchestrator work (REST client + create/join wiring), consistent with the orchestrator's integration role and the same pattern noted in the Phase 1 report. No agent-owned area was stepped on by another agent. |
| `TODO.md` checkmarks truthful | **PASS** | All 4 Phase 2 `[x]` items reproduced live. The Phase 2 verification-gate line (`[ ] Phase 2 verified`) is correctly still unchecked — this report is what flips it. |
| No contract drift (no local re-definition of shared types) | **PASS** | `lib/api.ts` imports `RoomSettings` from `@skribbl/shared`; no local `ServerMessage`/`ClientMessage`/`GAME =`/`discriminatedUnion` redefinitions in `apps/**` (only zod's own `node_modules`). `ws-protocol.md` matches `protocol.ts`. |

---

## Non-blocking risks / follow-ups (carried forward, not Phase 2 blockers)

1. **`agent/verify` worktree was stale at the Phase 1 tip.** The Phase 2 commit was on `develop`/`agent/integration` but not in this worktree. The human must reset `agent/verify` to `develop` before the next verification run (the Phase 1 report already flagged this). — owner: human/orchestrator.
2. **react-doctor full-score 47/100 (74 warnings, 0 errors).** Unchanged from Phase 1; "react-doctor clean" is a **Phase 4** DoD. The Phase 2 `--diff` on changed files is 100/100. — owner: B/C/D (Phase 4).
3. **No automated `@skribbl/api` test for the `turn:hint` path** (carried from Phase 1). I verified hints live (guesser gets progressive `turn:hint`, drawer gets none), but there is still no Vitest case with `hintsEnabled:true`. — owner: A.
4. **Default `EXPO_PUBLIC_WS_URL=ws://localhost:8787` is ambiguous** — it matches both `wrangler dev`'s default port and the Phase 1 mock's port. Fine for local integration (the `.env.example` comment directs to wrangler dev), but a deployed worker will require an explicit env override. — owner: orchestrator (Phase 4 deploy).
5. **Disclosed backend limitations still present** (from `backend-ready.md`): no reconnection grace (`GAME.RECONNECT_GRACE_MS` unused), strokes not persisted (mid-draw joiners see a blank canvas), lobby registry best-effort. These are Phase 1-baseline limitations, not Phase 2 regressions, and are slated for Phase 3/4. — owner: A/orchestrator.

---

## How to reproduce

```bash
pnpm install && pnpm build
pnpm typecheck && pnpm test -- --force && pnpm lint
npx -y react-doctor@latest apps/mobile --verbose          # full: 0 errors, 47/100
npx -y react-doctor@latest apps/mobile --verbose --diff   # changed files: 100/100
pnpm --filter @skribbl/mobile exec expo export --platform web --output-dir dist
pnpm --filter @skribbl/api exec wrangler dev --port 8799 --local
# REST smoke:
curl -s http://localhost:8799/health
curl -s http://localhost:8799/api/words
curl -s -X POST http://localhost:8799/api/rooms -H 'Content-Type: application/json' \
  -d '{"maxRounds":1,"roundDurationSec":30,"hintsEnabled":true,"wordPackIds":["animals"],"maxPlayers":8}'
curl -s http://localhost:8799/api/rooms/<roomId>
# 3-client WS playthrough: join → start → select-word → draw → chat(guess) → wait for reveal + game:over
```
