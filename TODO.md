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

- [ ] Point client `EXPO_PUBLIC_WS_URL` at `wrangler dev`
- [ ] 3–4 client end-to-end playthrough
- [ ] Resolve protocol mismatches; tag contract `v1`

## Phase 3 — Enhancements

- [ ] Public lobby browser (D1 + KV)
- [ ] Custom word packs (host-created, D1)
- [ ] Sounds + haptics; theming; transitions + confetti
- [ ] Hints polish; close-guess UX

## Phase 4 — Hardening & deploy

- [ ] RN component tests + Playwright web E2E + room load test
- [ ] Reconnection/disconnect/empty-room edge cases; rate limiting
- [ ] Security pass (no client secrets; word hidden; authoritative timer/scoring)
- [ ] Deploy: Worker + DO + D1 (Wrangler) · web → Cloudflare Pages · mobile → EAS
- [ ] `react-doctor` clean; CI green

## Verification gates (Verifier agent — run after merging each phase)

- [~] Phase 1 verified — `agents/verify.sh 1` → `docs/verification/phase-1.md` = PASS (develop pushed; stale agent/verify worktree must be reset before re-run)
- [ ] Phase 2 verified — `agents/verify.sh 2` → PASS
- [ ] Phase 3 verified — `agents/verify.sh 3` → PASS
- [ ] Phase 4 verified — `agents/verify.sh 4` → PASS
