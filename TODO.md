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

- [ ] `wrangler init` + `wrangler.toml` with DO, D1, KV bindings
- [ ] Hono app: `POST /api/rooms`, `GET /api/rooms`, `GET /api/rooms/:id`, `GET /api/words`
- [ ] WebSocket upgrade route → `GameRoom` DO (`/api/rooms/:id/ws`)
- [ ] `GameRoom` DO: hibernating WebSockets, join/leave, host migration
- [ ] State machine via **DO Alarms** (choosing → drawing → reveal → next/over)
- [ ] Server-authoritative scoring + word masking + hints + close-guess
- [ ] D1 schema + Drizzle migrations (word packs, lobby registry)
- [ ] KV: public lobby list cache + rate limiting
- [ ] Vitest (`@cloudflare/vitest-pool-workers`) for DO logic
- [ ] Post `docs/handoffs/backend-ready.md`

## Phase 1B — App shell + design system (Agent B · `apps/mobile`)

- [ ] `create-expo-app` (TypeScript) + Expo Router + react-native-web
- [ ] NativeWind v4 setup + theme tokens (light/dark) + typography
- [ ] Create shared folders `features/`, `lib/` and post `frontend-integration.md`
- [ ] UI kit: Button, Input, Card, Modal, Avatar, Toast (lucide icons)
- [ ] Screens: Home, Create Room, Join Room, Lobby browser, Settings
- [ ] Avatar picker (emoji + color) + on-device persistence (MMKV/AsyncStorage)
- [ ] App state store (Zustand): identity, connection, room

## Phase 1C — Realtime canvas + WS client (Agent C)

- [ ] Typed WS client in `lib/realtime` (connect, reconnect, heartbeat, zod-validated)
- [ ] Skia canvas: strokes, colors, brush sizes, eraser, undo, clear
- [ ] Normalized coordinates (0–1) + coalesced/throttled stroke batching
- [ ] Render remote `draw` / `draw:clear` / `draw:undo`
- [ ] Works on iOS, Android, and Web (CanvasKit WASM config)

## Phase 1D — Game flow (Agent D · `features/game`)

- [x] Game screen composition (canvas + chat + header) — phase-routed, responsive `GameScreen`; deps injected via `GameDepsProvider`
- [x] Word-choice UI (drawer picks 1 of 3) + masked word display — `WordChoiceModal` + `WordBanner` (drawer word / guesser blanks / hints)
- [x] Chat / guess panel with correct/close styling — `ChatPanel` (per-kind styles, input lock on correct, close nudge)
- [x] Server-synced countdown timer (uses `phaseEndsAt`) — `useCountdown`/`selectCountdown` re-sync on each `room:state`
- [x] Live scoreboard + turn reveal + final leaderboard — `Scoreboard` (list/strip), `TurnRevealOverlay`, `GameOverScreen` + confetti
- [x] Reactions (emoji), join/leave + win animations — `ReactionBar`/`ReactionsLayer`, roster handled in reducer, `Confetti` + Animated FX
- Note: pure state layer (`state/`) typechecks + 30 vitest cases pass incl. a live 3-client mock playthrough (anti-cheat verified). Built ahead of B's scaffold + C's client via stubbed deps; RN typecheck / react-doctor / web playthrough pending those merges.

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

- [ ] Phase 1 verified — `agents/verify.sh 1` → `docs/verification/phase-1.md` = PASS
- [ ] Phase 2 verified — `agents/verify.sh 2` → PASS
- [ ] Phase 3 verified — `agents/verify.sh 3` → PASS
- [ ] Phase 4 verified — `agents/verify.sh 4` → PASS
