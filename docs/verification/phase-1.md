# Phase 1 Verification — `skribbl-cloud`

**Verifier:** automated strict QA gate (read-only; no source edits, no commits).
**Branch:** `agent/verify` @ `e5ea627` (up to date with `origin/develop`).
**Date:** 2026-06-22
**Toolchain:** Node v22.14.0 · pnpm 9.12.3 · turbo 2.9.18 · wrangler 4.10.0 · react-doctor v0.5.8

---

## VERDICT: PASS

Every Phase 1 Definition-of-Done item and every applicable anti-cheat invariant
is satisfied with concrete evidence (commands run live, not replayed). The full
gate is green, the Cloudflare Worker + Durable Object serve REST + WebSocket and
reproduce the contract behaviour, and a **real 3-client playthrough against
`wrangler dev`** completes end-to-end (create → join → start → choose → draw →
guess → hint → reveal → rounds → leaderboard) while never leaking the word to
guessers.

PASS is recorded against the bar the phase prompts actually set (react-doctor
**errors** fixed → 0 errors; web build works; typecheck/test/lint clean; full
playthrough works). The non-blocking risks below (react-doctor score, one
untested server path, disclosed backend limitations) are explicitly accepted as
out-of-scope-for-Phase-1 or post-Phase-1 work and are listed so they are not
forgotten.

---

## Gate output (fresh runs, cache bypassed where relevant)

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install` | up to date, 0 errors |
| Build | `pnpm build` | `@skribbl/shared` built (ESM+CJS+DTS), success |
| Typecheck | `pnpm typecheck` | **5/5 packages pass** (`@skribbl/{shared,mobile,api,mock-ws-server}` + root) |
| Test | `pnpm test -- --force` | **4/4 packages pass — 81 tests** |
| Lint | `pnpm lint` (`eslint .`) | **clean**, exit 0 |

Test breakdown (force-executed, no cache):
- `@skribbl/shared`: **33 passed** (scoring 9, mask 5, words 6, protocol 7, state-machine 6)
- `@skribbl/api`: **18 passed** (`game.test.ts` 11 + `rest.test.ts` 7, `@cloudflare/vitest-pool-workers`)
- `@skribbl/mobile`: **30 passed** (gameStore 18, selectors 11, **`playthrough.e2e.test.ts` live 3-client mock playthrough** 1 · 12.0s)

---

## Definition of Done — item by item

### Phase 1A — Backend / Durable Object (`apps/api`)
| DoD item | Status | Evidence |
|---|---|---|
| `wrangler dev` serves REST + WS; behaviour matches the mock | **PASS** | `wrangler dev --port 8799 --local` booted with GAME_ROOM (DO), KV, D1 simulated. `GET /health`→`{"ok":true}`; `GET /api/words`→3 packs; `POST /api/rooms`→`{roomId,settings}`; `GET /api/rooms/:id`→`{exists,room}`; unknown id→404 `{exists:false}`; `GET .../ws` without upgrade→426. |
| `pnpm --filter @skribbl/api test` passes | **PASS** | 18/18 (full playthrough, masking, scoring, alarm timeouts, host migration, ROOM_FULL, NOT_ALLOWED/INVALID_MESSAGE guards). |
| typecheck + lint clean | **PASS** | see gate table. |
| TODO 1A checked off | **PASS** | all `[x]`. |
| `docs/handoffs/backend-ready.md` filled | **PASS** | endpoints, local WS URL, bindings, deviations & known limits all documented. |

### Phase 1B — App shell + design system (`apps/mobile`)
| DoD item | Status | Evidence |
|---|---|---|
| App runs on web; all screens navigable | **PASS** | `expo export --platform web` succeeded — 8 static routes: `/`, `/create`, `/join`, `/lobby/[id]`, `/room/[id]`, `/settings`, `/+not-found`, `/_sitemap`. |
| Design system / UI kit | **PASS** | `components/ui/`: button, icon-button, input, card, modal, avatar, badge, toast, spinner, text, stepper, switch-row, chip, screen. NativeWind v4 (`global.css`, `tailwind.config.js`), theme tokens in `theme/`. |
| Folders + documented contracts for C/D | **PASS** | `features/canvas`, `features/game`, `lib/realtime` exist; `docs/handoffs/frontend-integration.md` present. |
| Avatar picker + on-device persistence | **PASS** | `components/avatar-picker.tsx`; `lib/store/identity.ts` uses zustand `persist` + AsyncStorage (persists nickname/avatar/settings). |
| Zustand stores (`useIdentity`, `useRoomStore`, draft) | **PASS** | `lib/store/{identity,room,draft,selectors}.ts`. |
| TODO 1B checked off | **PASS** | all `[x]`. |

### Phase 1C — Realtime canvas + WS client (`features/canvas`, `lib/realtime`)
| DoD item | Status | Evidence |
|---|---|---|
| Typed WS client: validates frames, join-first, reconnect, heartbeat, feeds store | **PASS** | `RoomConnection.ts`: first frame is `join` (L178); every inbound frame via `parseServerMessage` (L201); outbound via `encode`; exp-backoff + full-jitter reconnect (L231-242); ping/pong heartbeat on `GAME.HEARTBEAT_INTERVAL_MS` (L79/253-264). |
| Skia canvas: strokes/colors/sizes/eraser/undo/clear | **PASS** | `features/canvas/components/{DrawCanvas,Toolbar}.tsx`, `hooks/useDrawingBoard.ts`. |
| Normalized coordinates (0–1) + batching | **PASS** | `lib/coords.ts` `toNormalized`/`toPixels`/`clamp01`; `lib/strokeBatcher.ts`. Verified live: mirrored `draw` frames all had `x,y ∈ [0,1]`. |
| Render remote draw / draw:clear / draw:undo; reset on turn:start | **PASS** | `lib/realtime/strokes.ts` + store reconstruction; live drawer→guesser mirroring observed. |
| Cross-platform iOS/Android/Web (CanvasKit WASM) | **PARTIAL (disclosed)** | Web build works; `CanvasKitProvider.{tsx,native.tsx}` + docs present; **native on-device visual run still pending** — honestly tracked as `[~]` in TODO L54. Not a Phase-1 blocker per the prompt ("works on web (and is RN-correct for native)"); web is proven, native code typechecks against real Skia/gesture-handler. |

### Phase 1D — Game flow (`features/game`)
| DoD item | Status | Evidence |
|---|---|---|
| Complete polished game loop end-to-end vs mock | **PASS** | `playthrough.e2e.test.ts` (live 3-client mock) passes; additionally reproduced live against the real DO (see playthrough below). |
| Header/HUD, word area, word-choice modal, canvas slot, chat/guess, scoreboard, reveal, game-over, reactions, lobby↔game transitions | **PASS** | components present: `GameHeader`, `WordBanner`, `WordChoiceModal`, `CanvasStage`, `ChatPanel`, `Scoreboard`, `TurnRevealOverlay`, `GameOverScreen`+`Confetti`, `ReactionBar`/`ReactionsLayer`, `LobbyView`. |
| Server-synced countdown from `phaseEndsAt` | **PASS** | `hooks/useCountdown.ts` + `selectCountdown` render `endsAt - now`, re-sync on each `room:state`. No client-driven turn end. |
| TODO 1D checked off | **PASS** | all `[x]`. |

---

## Live multi-client playthrough vs `wrangler dev` (real DO)

3 WebSocket clients (Alice/Bob/Cara) against `ws://localhost:8799/api/rooms/<id>/ws`,
`maxRounds:1` (→ 3 turns), `hintsEnabled:true`. Every assertion below passed:

- First joiner = host; `room:state` carried `youId`.
- Each turn: **exactly one** client received `turn:choosing.choices` (non-null);
  others got `choices: null`. 3 choices each.
- `turn:start`: drawer received the real `word`; **both guessers received
  `word: null`**, a fully-masked `maskedWord` (`_______`, `____`, `__________`),
  and the correct `wordLength`. (Frame-level anti-cheat confirmed.)
- Drawer stroke `{points:[{0.1,0.2},{0.5,0.6}], width:6, mode:"draw"}` mirrored to a
  guesser with all coordinates in `[0,1]`.
- Correct guess → `guess:correct` with bounded `points` (≤300); `scores:update`.
- `turn:reveal.word` matched for all clients; drawer earned `roundPoints=150`
  (`DRAWER_MAX_POINTS`, everyone guessed).
- Alarm-driven `reveal → next turn → game:over` fired in real time (server clock).
- `game:over.leaderboard` had 3 players, sorted desc (`Alice:750, Bob:740, Cara:730`).

Separate **hint** verification (no one guesses, 30s turn, hints on): the guesser
received `turn:hint` with `maskedWord="_____p____"` (1 letter revealed) and the
**drawer never received `turn:hint`**.

---

## Non-negotiable invariants

| Invariant | Status | Evidence |
|---|---|---|
| `word` never sent to non-drawers | **PASS** | DO: `buildState` `word: isDrawer ? r.word : null` (L709), `wordChoices` drawer-only (L710); `turn:start` `word: isDrawer ? word : null` (L471); `turn:choosing` `choices` drawer-only (L423). **Live frames confirmed** `word:null` + masked for guessers. |
| Timer server-authoritative (DO Alarms, not client) | **PASS** | `armAlarm` uses `ctx.storage.setAlarm()`/`deleteAlarm()` (L257-258); single `alarm()` handler drives `choosing→drawing→reveal→next/over` (L206-236). No `setTimeout`/`setInterval` for game timing in the DO. Client `useCountdown` only renders `phaseEndsAt - now`. |
| Scoring/validation server-side via `@skribbl/shared` | **PASS** | DO imports & uses `calculateGuesserScore`, `calculateDrawerScore`, `isExactGuess`, `isCloseGuess` (L486-499); client never computes points. |
| Draw coordinates normalized 0–1 | **PASS** | `coords.ts` clamps to `[0,1]`; `pointSchema`/`strokeSchema` in shared; live mirrored frames in range. |
| No secrets committed | **PASS** | grep across `*.{ts,tsx,js,json,toml,env,mjs}` for key/secret/token/PEM/AWS/Slack/GitHub/OpenAI patterns → **none**. Only tracked env file is `apps/mobile/.env.example` (`EXPO_PUBLIC_WS_URL` only). `wrangler.toml` holds placeholder binding ids, not secrets. |
| Agents stayed in ownership lanes | **PASS (with note)** | Final tree respects the matrix: `apps/api/**` (A), `app/`·`components/`·`theme/`·`lib/store/` (B), `features/canvas/`·`lib/realtime/` (C), `features/game/` (D). Cross-cutting integration glue (`lib/gameDeps.tsx`, `lib/config.ts`, `app/room/[id].tsx` mount) was added by the **orchestrator integration commits** (`4093cbc` "wire frontend", `e5ea627` "resolve verifier blockers"), which is the human/orchestrator's role — not an agent overstepping. |
| `TODO.md` checkmarks truthful | **PASS** | Every `[x]` independently verified. The only unfinished Phase-1 item (canvas native visual run, L54) is honestly `[~]`. The Phase-1 verification gate (L90) is `[~]` (in progress) — consistent with this report being produced now. |
| No contract drift (no local re-definition of shared types) | **PASS** | grep in `apps/**` for local `GAME =`, `discriminatedUnion`, or re-declared `ServerMessage`/`ClientMessage` types → **none**. All consumers import from `@skribbl/shared`; `ws-protocol.md` matches `protocol.ts`. |

---

## Non-blocking risks / follow-ups (accepted for Phase 1)

1. **react-doctor score 47/100 (71 warnings, 0 errors).** Source-only run.
   The phase agent prompts require fixing **errors** (met: 0). PLAN's
   "react-doctor clean" is a **Phase 4** DoD, not Phase 1. Top recurring
   warnings to burn down later: `Animated` (RN) vs Reanimated ×6,
   `useRef(new …)` lazy-init ×7, large inline styles ×8, non-virtualized
   `ScrollView` lists ×2 (`Toolbar.tsx:42`, `Scoreboard.tsx:31`), 32
   unused exports, 2 unused `__verify__/*.ts` files. — owners: B/C/D.
2. **No automated test for the DO `turn:hint` path.** Every `apps/api` test sets
   `hintsEnabled:false`; hint emission was only verified manually (live, above).
   Add a `@skribbl/api` test that enables hints and asserts guessers get
   progressive `turn:hint` while the drawer does not. — owner: A.
3. **Disclosed backend limitations (post-Phase-1, in `backend-ready.md`):** no
   reconnection grace (close removes player immediately; `GAME.RECONNECT_GRACE_MS`
   unused); strokes not persisted, so mid-draw joiners see a blank canvas; lobby
   registry is best-effort/eventually-consistent (`GET /api/rooms` may lag; the
   public lobby **browser UI** is explicitly Phase 3). These match the mock and
   are acceptable for Phase 1. — owner: A (Phase 4) / orchestrator (Phase 3).

---

## How to reproduce
```bash
pnpm install && pnpm build
pnpm typecheck && pnpm test -- --force && pnpm lint
# backend smoke + playthrough:
pnpm --filter @skribbl/api exec wrangler dev --port 8799 --local
#   curl http://localhost:8799/health | /api/words | -XPOST /api/rooms | /api/rooms/:id
# frontend:
pnpm --filter @skribbl/mobile exec expo export --platform web --output-dir dist
npx -y react-doctor@latest apps/mobile
```
