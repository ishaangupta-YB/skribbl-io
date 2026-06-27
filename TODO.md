# TODO — skribbl-cloud

Living checklist. Each agent checks off items in its area and adds a one-line note. Keep this honest — it is the shared source of truth for status.

**Process:** agents do NOT commit. An agent prints a COMMIT CHECKPOINT and stops; the **human** reviews (`agents/review.sh`), commits, merges into `develop`, then runs the **Verifier** gate (`agents/verify.sh <phase>`).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Foundation & Contract (Orchestrator)

- [x] Monorepo tooling: pnpm workspace, Turborepo, base tsconfig, ESLint, Prettier, .gitignore
- [x] `@skribbl/shared`: constants, schemas (Zod), protocol (client/server messages)
- [x] `@skribbl/shared`: scoring (guesser/drawer/levenshtein/close-guess), mask/hints, state machine, word packs, utils
- [x] `@skribbl/shared`: Vitest suite (scoring, mask, state-machine, protocol, words)
- [x] `tools/mock-ws-server`: full protocol + game loop for UI development
- [x] Docs: PLAN, AGENTS, architecture, ws-protocol, handoffs
- [x] `pnpm install` + `build` + `test` (33 passing) + `typecheck` + `lint` green; mock server boots (verified locally on Node 22 / pnpm 9.12.3)
- [x] Agent launchers: `agents/` (tmux + Devin CLI spinup, per-phase scripts, prompts) — syntax-checked
- [x] Verifier/reviewer tooling: `agents/prompts/verifier.md` + `agents/verify.sh` + `agents/review.sh` (strict per-phase QA gate; human-owned commits)
- [ ] **You:** make the first commit on the `skribbl-cloud` repo (`git add -A && git commit -m "chore: phase 0 foundation"`), then run `agents/start-phase-1.sh` (creates the `develop` branch ref + per-agent worktrees OUTSIDE the repo + a tmux window with 4 panes). Agents never commit — see `agents/README.md`.

## Phase 1A — Backend / Durable Object (Agent A · `apps/api`)

- [x] `wrangler init` + `wrangler.toml` with DO, D1, KV bindings — `apps/api/wrangler.toml` (GAME_ROOM/DB/KV, `nodejs_compat`, SQLite DO)
- [x] Hono app: `POST /api/rooms`, `GET /api/rooms`, `GET /api/rooms/:id`, `GET /api/words` — `apps/api/src/index.ts`
- [x] WebSocket upgrade route → `GameRoom` DO (`/api/rooms/:id/ws`) — forwards via `idFromName(roomId)`
- [x] `GameRoom` DO: hibernating WebSockets, join/leave, host migration — `apps/api/src/durable/GameRoom.ts`
- [x] State machine via **DO Alarms** (choosing → drawing → reveal → next/over) — single alarm, `phase-end`/`hint` purposes
- [x] Server-authoritative scoring + word masking + hints + close-guess — all via `@skribbl/shared`; word only to drawer
- [x] D1 schema + Drizzle migrations (word packs, lobby registry) — `apps/api/src/db/`, `apps/api/migrations/0001_init.sql` (seeds bundled packs)
- [x] KV: public lobby list cache + rate limiting — `apps/api/src/lib/{lobby,rate-limit}.ts`
- [x] Vitest (`@cloudflare/vitest-pool-workers`) for DO logic — 18 tests (playthrough, masking, scoring, alarms, host migration)
- [x] Post `docs/handoffs/backend-ready.md` — filled in

## Phase 1B — App shell + design system (Agent B · `apps/mobile`)

- [x] Expo (TypeScript) + Expo Router + react-native-web — SDK 56; web verified (`expo export` + dev server boot)
- [x] NativeWind v4 setup + theme tokens (light/dark) + typography — tokens in `global.css` + `tailwind.config.js`, hex mirror in `theme/`
- [x] Create shared folders `features/` (canvas+game), `lib/` (realtime+store) and post `frontend-integration.md`
- [x] UI kit: Button, IconButton, Input, Card, Sheet(Modal), Avatar, Badge, Toast, Spinner, Text, Stepper, SwitchRow, Chip, Screen (lucide icons)
- [x] Screens: Home, Create, Join, Lobby (waiting), Room shell (mounts D), Settings — public lobby browser deferred to Phase 3
- [x] P0 integration: `app/room/[id].tsx` mounts `<GameScreen>` with real B/C/D deps (lib/gameDeps.tsx adapter + CanvasKitProvider) — typecheck + tests green
- [x] Avatar picker (emoji + color) + on-device persistence (AsyncStorage via zustand persist)
- [x] App state store (Zustand): `useIdentity`, `useRoomStore` (+ `applyServerMessage`/selectors), `useRoomDraft`

## Phase 1C — Realtime canvas + WS client (Agent C)

- [x] Typed WS client in `lib/realtime` (connect, reconnect, heartbeat, zod-validated) — `RoomConnection` + `useRoomConnection`; e2e-verified vs mock (20/20 checks)
- [x] Skia canvas: strokes, colors, brush sizes, eraser, undo, clear — `DrawCanvas` + `Toolbar` + `useDrawingBoard`
- [x] Normalized coordinates (0–1) + coalesced/throttled stroke batching — `coords.ts` + `StrokeBatcher` (~30fps, bridged segments); pure-logic verified
- [x] Render remote `draw` / `draw:clear` / `draw:undo` — store reconstructs full strokes from segments; resets on `draw:clear` + `turn:start`
- [~] Works on iOS, Android, and Web (CanvasKit WASM config) — cross-platform code + `CanvasKitProvider` (web WASM loader, native no-op) + docs delivered; typechecks vs real Skia/gesture-handler. Visual run on all 3 platforms pending B's Expo scaffold. See `docs/handoffs/canvas-integration.md`.

## Phase 1D — Game flow (Agent D · `features/game`)

- [x] Game screen composition (canvas + chat + header) — phase-routed, responsive `GameScreen`; deps injected via `GameDepsProvider`
- [x] Word-choice UI (drawer picks 1 of 3) + masked word display — `WordChoiceModal` + `WordBanner` (drawer word / guesser blanks / hints)
- [x] Chat / guess panel with correct/close styling — `ChatPanel` (per-kind styles, input lock on correct, close nudge)
- [x] Server-synced countdown timer (uses `phaseEndsAt`) — `useCountdown`/`selectCountdown` re-sync on each `room:state`
- [x] Live scoreboard + turn reveal + final leaderboard — `Scoreboard` (list/strip), `TurnRevealOverlay`, `GameOverScreen` + confetti
- [x] Reactions (emoji), join/leave + win animations — `ReactionBar`/`ReactionsLayer`, roster handled in reducer, `Confetti` + Animated FX
- [x] P1 test gate: `apps/mobile` now has `test` script + `ws`/`@types/ws`/`tsx`/`vitest` devDeps; `playthrough.e2e.test.ts` (30 cases incl. live 3-client mock) passes
- Note: real B/C/D integration wired in `app/room/[id].tsx` + `lib/gameDeps.tsx`. Local gates: typecheck 5/5 + tests 81 green + lint green. react-doctor: 0 errors, 71 warnings, 47/100; vitest supply-chain warning downgraded to warning (dev-only runner, no browser mode).

## Phase 2 — Integration (Orchestrator + A)

- [x] Point client `EXPO_PUBLIC_WS_URL` at `wrangler dev` — defaults to `ws://localhost:8787` (matches wrangler dev); `lib/config.ts` now also derives `HTTP_BASE_URL` for REST.
- [x] Wire create flow to `POST /api/rooms` and join flow to `GET /api/rooms/:id` — `lib/api.ts` REST client; `app/create.tsx` + `app/join.tsx` navigate straight to `/room/[id]` (live `LobbyView`).
- [x] 3–4 client end-to-end playthrough — 32/32 live checks pass vs real DO (create→join→start→choose→draw→guess→hint→reveal→rounds→leaderboard).
- [x] Resolve protocol mismatches; tag contract `v1` — **none found**; `@skribbl/shared` bumped to `1.0.0`, `docs/handoffs/contract.md` tagged `v1`.
- [x] Anti-cheat invariants verified live — word/choices only to drawer; non-host start → `NOT_ALLOWED`; non-drawer draw ignored; drawer typing the word suppressed; scores server-only.
- [x] Edge cases verified live — host migration, drawer-leaves-mid-turn (abort+reveal+next), reconnect (fresh `room:state`), empty-room cleanup (reset to lobby).

## Phase 3 — Enhancements

- [x] Public lobby browser (D1 + KV) — registry now has `name`, KV-cached list, paginated/joinable `GET /api/rooms`, and a Lobby Browser screen with live refresh / pull-to-refresh / Join. Verified with API tests + mobile typecheck/lint/react-doctor.
- [x] Custom word packs (host-created, D1) — normalized `word_packs` + `words` tables; `POST /api/word-packs` + `GET /api/word-packs/:id`; pack picker + custom-word textarea + persistence in Create Room; default pack remains fallback.
- [x] Sounds + haptics; theming; transitions + confetti — Polish Agent: added generated SFX, `useGameSound`/`useGameHaptics`, theme system override, `PhaseAnnounce`, score-tick + guess-pulse animations, win confetti intact, quick emoji picker.
- [x] Hints polish; close-guess UX — server already reveals hint letters (alarm-driven `turn:hint`) and detects close guesses (`isCloseGuess` → private `kind:"close"` chat). Client polish added: the "you're close!" banner now auto-dismisses after `CLOSE_FEEDBACK_TTL_MS` (pure `selectCloseFeedback` selector + local timer) with a fade in/out, and newly revealed hint letters pop in (`WordBanner`). Selector unit-tested; typecheck/test/lint/react-doctor green.

## Phase 4 — Hardening & deploy

- [x] RN component tests + Playwright web E2E + room load test — QA agent: canvas lib (coords, strokeBatcher) + realtime (strokes, RoomConnection with mock socket) unit tests (38 tests); live wrangler-dev protocol E2E (3-client playthrough, non-host rejection, host migration, 3 tests) now finds wrangler robustly; load test script (N rooms × M clients, verified 3×2). Playwright web E2E spec rewritten to match the real Expo web UI, instrumented with `data-testid`, and wired into GitHub Actions (`.github/workflows/ci.yml`) via static web export + `wrangler dev`. All tests green.
- [x] Reconnection/disconnect/empty-room edge cases; rate limiting — QA agent: `apps/api/test/edge-cases.test.ts` (11 tests: reconnection grace, empty-room cleanup, rate limiting, simultaneous correct guesses, all-guessed-early, oversized/garbage frames, drawer disconnect mid-turn). Also fixed a heartbeat bug in `RoomConnection.ts` (pong timer was reset every tick, preventing dead-socket recycling).
- [x] Security pass (no client secrets; word hidden; authoritative timer/scoring) — QA agent: `apps/api/test/security.test.ts` (12 tests: word never leaks to guessers, game:over has no word field, room:state drawer-only fields hidden, drawer chat suppression, server-authoritative timer/scoring, input validation, authorization, rate limiting). Full report: `docs/verification/phase-4-security-pass.md` — verdict PASS.
- [x] Deploy: Worker + DO + D1 + KV (Wrangler) · web → Cloudflare Pages · mobile → EAS — runbook in `docs/deploy.md`, CI/CD in `.github/workflows/`
- [x] `react-doctor` clean; CI green — CI workflow (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, backend DO tests, frontend QA tests, E2E, and react-doctor. react-doctor: **100/100, no issues** — migrated RN `Animated` → `react-native-reanimated`, refactored `no-event-handler`/`no-cascading-set-state`/`no-chain-state-updates`/`prefer-useReducer`/inline-`renderItem`/`ScrollView`-list cases, removed dead code, and bumped `vitest` → 3.2.6 to clear the supply-chain advisory. The maintainability rule `deslop/unused-export` is ignored in `doctor.config.json` for intentional library-surface exports (B/C public APIs). typecheck + test + lint all green locally.

## Verification gates (Verifier agent — run after merging each phase)

- [x] Phase 1 verified — `agents/verify.sh 1` → `docs/verification/phase-1.md` = PASS
- [x] Phase 2 verified — `agents/verify.sh 2` → `docs/verification/phase-2.md` = PASS
- [x] Phase 3 verified — `agents/verify.sh 3` → `docs/verification/phase-3.md` = PASS
- [x] Phase 4 verified — `agents/verify.sh 4` → `docs/verification/phase-4.md` = PASS
