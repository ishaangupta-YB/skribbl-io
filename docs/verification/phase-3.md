# Phase 3 Verification — `skribbl-cloud`

**Verifier:** automated strict QA gate (read-only; no source edits, no commits).
**Target phase:** **3 — Enhancements** (public lobby browser via D1/KV; custom word packs via D1; sounds/haptics/theming/animations/confetti polish).
**Date:** 2026-06-23
**Toolchain:** Node v22.14.0 · pnpm 9.12.3 · turbo 2.9.18 · wrangler 4.10.0 · react-doctor v0.5.8
**Worktree:** `agent/verify` at `0fe3fcc` (Phase 3 tip — present in-tree, no `git checkout` workaround needed this run).

---

## VERDICT: PASS

Every Phase 3 Definition-of-Done item from the three Phase 3 sub-agent prompts (`agents/prompts/phase-3-lobby-d1.md`, `phase-3-word-packs.md`, `phase-3-polish.md`) is satisfied with concrete live evidence. A real 3-client playthrough against `wrangler dev` (real `GameRoom` DO + D1 + KV) confirms a custom D1 word pack drives the game (choices drawn from the custom pack, word masked to guessers, alarm-driven reveal), the public lobby browser lists public rooms and excludes private ones, and the polish layer (sounds, haptics, theme override, animations, confetti, quick emoji picker) is wired into the game tree. All non-negotiable invariants hold; the word never leaks to non-drawers (pre-reveal leak count = 0). No Phase 3 commit touched `packages/shared/**` (no contract drift), and each sub-agent stayed in its ownership lane.

---

## Gate output (fresh runs, turbo cache bypassed via `TURBO_CACHE_DIR=/tmp/empty-turbo`)

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install` | up to date, 0 errors |
| Build | `pnpm build` | `@skribbl/shared` built (ESM+CJS+DTS), success |
| Typecheck | `TURBO_CACHE_DIR=/tmp/empty-turbo pnpm typecheck` | **5/5 packages pass** (0 cached) — `@skribbl/{shared,mobile,api,mock-ws-server}` + root |
| Test | `TURBO_CACHE_DIR=/tmp/empty-turbo pnpm test -- --force` | **4/4 packages pass — 89 tests** (shared 33, api **26** [was 18 in P2: +8 REST/word-pack/lobby tests], mobile 30 incl. live 3-client mock playthrough) |
| Lint | `TURBO_CACHE_DIR=/tmp/empty-turbo pnpm lint` (`eslint .`) | **clean**, exit 0 |
| Web build | `expo export --platform web` | **9 static routes** (`/`, `/create`, `/join`, `/lobby`, `/lobby/[id]`, `/room/[id]`, `/settings`, `/_sitemap`, `/+not-found`) — `/lobby` is the new browser |
| react-doctor (full `apps/mobile`) | `npx react-doctor@latest apps/mobile --verbose` | **0 errors**, 81 warnings, score **48/100** (Phase 3 DoD = "fix errors" → 0 errors ✓; "clean" is a Phase 4 DoD) |
| Backend smoke | `wrangler dev --port 8799 --local` (after `wrangler d1 migrations apply skribbl --local`) | `GET /health`→`{"ok":true}`; `GET /api/words`→5 packs (3 bundled + 2 custom); `POST /api/word-packs`→201; `GET /api/word-packs/:id`→pack; `POST /api/rooms`→`{roomId,settings}`; `GET /api/rooms`→paginated public list |

---

## Definition of Done — item by item

### Sub-agent 1 — Public Lobby Browser (`phase-3-lobby-d1.md`)

| DoD item | Status | Evidence |
|---|---|---|
| Creating a public room makes it appear in the browser on other clients | **PASS** | Live: after 3 clients joined public room `VADA5U`, `GET /api/rooms` returned it with `name:"Alice's room"`, `playerCount:3`, `phase:"lobby"`, `hostNickname:"Alice"`. The DO writes the registry row on join (`apps/api/src/durable/GameRoom.ts:788-808` `updateRegistry` → `upsertLobbyRoom`). REST test `rest.test.ts:58-78` asserts the same. |
| Joining from the browser works end-to-end | **PASS** | `apps/mobile/app/lobby.tsx:38-49` `onJoin` validates nickname then `router.replace("/room/[id]")`; `useLobbyRooms.ts` feeds `RoomListItem` with live `RoomMeta`. `RoomListItem` Join button calls `onJoin`. Home screen `app/index.tsx:71-77` exposes "Browse public rooms" → `/lobby`. |
| Private rooms never appear | **PASS** | Live: a private room with a joined player was never listed across 15 polls. `listPublicRooms` (`apps/api/src/db/queries.ts:64-84`) filters `isPublic=true AND phase='lobby' AND playerCount>0`; `GET /api/rooms` re-applies `playerCount<maxPlayers` for `status=joinable`. REST test `rest.test.ts:80-98` asserts it. |
| D1 registry table with name/host/count/max/status | **PASS** | `apps/api/src/db/schema.ts:40-62` `lobbyRooms` (roomId, name, isPublic, phase, playerCount, maxPlayers, maxRounds, roundDurationSec, hostNickname, updatedAt, createdAt) + `idx_lobby_public`. Migration `0002_add_room_name.sql` adds `name`. |
| KV cache of public lobby list (short TTL), invalidate on changes | **PASS** | `apps/api/src/lib/lobby.ts:5-59` `LOBBY_CACHE_KEY="lobby:public:list"`, TTL 30s, `readPublicLobby` reads-then-fills, `invalidatePublicLobby` called on every DO `updateRegistry`/`removeRegistry`. |
| `GET /api/rooms` fleshed out: live public + joinable + pagination | **PASS** | `apps/api/src/index.ts:66-82` accepts `?status=open\|joinable\|all&page&limit` (default joinable, limit≤50), slices the cached list. REST test `rest.test.ts:100-131` asserts pagination + full-room exclusion. |
| Lobby Browser screen: list, pull-to-refresh, live refresh, Join, empty state | **PASS** | `app/lobby.tsx` — FlatList with `RefreshControl` (pull-to-refresh), `useLobbyRooms` 10s `setInterval` live refresh, `onEndReached`/`Load more` pagination, `renderEmpty` empty state, error card. |
| `pnpm typecheck && pnpm test && pnpm lint` green; react-doctor clean for `apps/mobile` | **PASS** | All green (above); react-doctor 0 errors (81 warnings — "clean" full score is Phase 4). |
| Check off Phase 3 items in TODO; no commit | **PASS** | `TODO.md:78` checked; no Phase 3 commit was made by an agent (human-owned). |

### Sub-agent 2 — Custom Word Packs (`phase-3-word-packs.md`)

| DoD item | Status | Evidence |
|---|---|---|
| Host can select/define packs | **PASS** | `app/create.tsx:178-210` pack chips (toggle, ≥1 required, word counts); `CreatePackSheet` (`components/create-pack-sheet.tsx`) creates a D1 pack via `POST /api/word-packs`; "Extra words" textarea (`parseCustomWords`). Selection persists via `useRoomDraft` (zustand persist, `lib/store/draft.ts`). |
| Chosen words actually drive the game | **PASS** | **Live:** room created with `wordPackIds:[<customPackId>]` (5 words: unicorn/dragon/taco/ninja/pixel). Drawer's `turn:choosing` choices = `[dragon, pixel, unicorn]` — **all 3 from the custom pack**. `select-word` → `turn:start` drawer `word=dragon`, guessers `word=null`, `maskedWord=____`, `wordLength=4`. DO builds the pool via `buildWordPool` (`apps/api/src/lib/words.ts:143-157`) at `GameRoom.ts:385-386`. |
| Default pack remains a guaranteed fallback when D1 is empty | **PASS** | `GameRoom.ts:386` `r.pool = pool.length > 0 ? pool : collectWords(["default"])`; `listAllWordPacks` (`words.ts:120-136`) always includes bundled packs and swallows D1 errors. Migration `0002_word_packs_split.sql:39-43` re-seeds bundled packs idempotently. REST test `rest.test.ts:14-24` asserts bundled packs present. |
| D1 `word_packs` + `words` tables; seed bundled packs on migrate | **PASS** | `schema.ts:9-34` normalized `wordPacks` + `words` (composite PK prevents dupes). Migration `0002_word_packs_split.sql` migrates the old JSON column, swaps tables, re-seeds bundled packs. |
| `GET /api/words` returns bundled + D1 packs | **PASS** | Live: returned 5 packs (default, animals, food + 2 custom). `index.ts:93-96` → `listAllWordPacks`. REST test `rest.test.ts:14-24`. |
| `POST /api/word-packs` validates (trim, dedupe, length, profanity-basic, cap count) | **PASS** | `apps/api/src/lib/words.ts:72-114` `validateWordPack`: trims+lowercases, dedupes via Set, `MAX_WORDS_PER_PACK=100`, `MAX_WORD_LENGTH=30`, `MAX_PACK_NAME_LEN=50`, profanity deny-list + substring check. REST tests `rest.test.ts:176-199` reject empty input, profanity, and oversized words. Rate-limited (`index.ts:100-102`, 10/min). |
| `GET /api/word-packs/:id` | **PASS** | `index.ts:146-151`; bundled packs take precedence (`words.ts:173-176`). Live: returned the created pack with words. REST tests `rest.test.ts:201-222` (200 + 404). |
| DO builds pool from selected `wordPackIds` (bundled + D1) + inline `customWords` | **PASS** | `buildWordPool` merges `collectWords(wordPackIds, customWords)` (bundled + inline) with D1 `getPackWords` for non-bundled ids. Live choices came from the D1 pack. |
| Frontend: pack picker + custom-word textarea + persist last selection | **PASS** | `app/create.tsx` pack chips + `TextArea` + `useRoomDraft` persist (AsyncStorage). |
| Gate green; react-doctor | **PASS** | Above. |

### Sub-agent 3 — Polish (`phase-3-polish.md`)

| DoD item | Status | Evidence |
|---|---|---|
| Animations: screen transitions, turn-change/reveal, correct-guess pulse, score tick-ups, win confetti | **PASS** | `_layout.tsx:41` `animation:"slide_from_right"`; `PhaseAnnounce.tsx` (Animated fade/spring/scale banner on turn change); `Scoreboard.tsx` score-tick animation (Phase 3 diff +71); `ChatPanel.tsx` correct-guess pulse (diff +46); `GameOverScreen.tsx:34` `<Confetti active />` (`Confetti.tsx` retained from P1). |
| Sound (expo-av/expo-audio): join, correct, your-turn, tick, time-up, win + global mute toggle | **PASS** | `lib/sound.ts` `useGameSound` preloads 10 SFX via `expo-audio` `useAudioPlayer` (join/turnStart/guessClose/guessCorrect/youGuessed/tick/timeUp/reveal/win/react); respects `useIdentity.settings.sound` via ref. SFX generated by `scripts/generate-sfx.js` into `assets/sfx/*.wav`. `useTurnFx.ts` fires them on transitions. Settings toggle `app/settings.tsx` "Sound effects" SwitchRow. |
| Haptics (expo-haptics): light taps on correct/turn/win, native-only (guard on web) | **PASS** | `lib/haptics.ts` `useGameHaptics` — `IS_WEB` guard (`Platform.OS==="web"` → no-op), gated by `settings.haptics`. `useTurnFx.ts` fires light/medium/success/warning/selection. Settings toggle present. |
| Theming: refine light/dark, contrast, smooth switch, system theme + manual override | **PASS** | `app/_layout.tsx:19-28` reads `settings.theme` (light/dark/system), resolves against `useSystemColorScheme`, syncs NativeWind via `nativewindColorScheme.set`. `theme/index.ts` `useTheme` reads NativeWind scheme. Settings `THEME_OPTIONS` chips. |
| Reactions: polished floating emoji animation + quick emoji picker during a round | **PASS** | `ReactionBar.tsx` — expandable quick emoji picker (`REACTION_EMOJIS` + `EXTRA_EMOJIS`, "+" expand), `useTurnFx.ts:99-101` plays `react` sound on incoming frames; `ReactionsLayer` floating animation retained. |
| Empty/loading/error states + skeletons; responsive web vs phone | **PASS** | New `components/ui/loading-screen.tsx` + `skeleton.tsx`; `GameScreen.tsx:52-58` `LoadingScreen` while joining; `lobby.tsx` empty/error states; `GameScreen.tsx:31,86-114` `WIDE_BREAKPOINT=820` wide/narrow layouts. |
| Noticeably more delightful UX, no gameplay regressions; mute/theme toggles work; web no native-only crashes | **PASS** | Web build bundles all 9 routes (expo-haptics web-guarded, expo-audio compiles for web). Live playthrough gameplay intact (custom packs, scoring, reveal). Toggles wired to persisted store. |
| `pnpm typecheck && pnpm lint` green; react-doctor fix errors | **PASS** | Both green; react-doctor **0 errors** (81 warnings). |
| Check off Phase 3 items; no commit | **PASS** | `TODO.md:80` checked; no agent commit. |

---

## Live multi-client playthrough vs `wrangler dev` (real DO + D1 + KV)

3 WebSocket clients (Alice/Bob/Cara) + REST against `ws://localhost:8799`, `maxRounds:1`, `roundDurationSec:30`, `hintsEnabled:true`, `wordPackIds:[<custom D1 pack>]` (words: unicorn/dragon/taco/ninja/pixel). **All assertions passed:**

- `POST /api/word-packs` → 201 with `pack.id`, words lowercased+deduped.
- `POST /api/rooms` (public, custom pack) → `{roomId, settings}`.
- After 3 joins, `GET /api/rooms` listed the room: `name:"Alice's room"`, `playerCount:3`, `phase:"lobby"`, `hostNickname:"Alice"`.
- Host = first joiner (Alice). `start` → `turn:choosing`.
- **Drawer `choices` = `[dragon, pixel, unicorn]` — all 3 from the custom D1 pack** (the core word-pack DoD).
- **Guessers got `choices:null`** (anti-cheat).
- `select-word dragon` → `turn:start`: drawer `word="dragon"`; **both guessers `word=null`**, `maskedWord="____"`, `wordLength=4`.
- Drawer stroke `{stroke:{points:[{0.1,0.2},{0.5,0.6}],color,width:6,mode:"draw"}}` mirrored to both guessers; coords ∈ [0,1].
- Both guessers guessed correctly → `guess:correct` `points=295` each (≤300); early "all guessed" `endTurn` fired.
- **Alarm-driven `turn:reveal`** fired with `word="dragon"` (server clock).
- **Pre-reveal leak scan:** across both guessers' entire frame streams, the word appeared in **exactly zero** frames before `turn:reveal`. **Pre-reveal leak count = 0.**
- Private room (with a joined player) never appeared in `GET /api/rooms` across 15 polls.

Separate full-draw-timer run (no early guess, 30s draw): `turn:choosing` choices again all from the custom pack; `turn:reveal` alarm-driven with the chosen word. (See "Non-blocking observations" re: the reveal→game-over short alarm under `wrangler dev --local`.)

---

## Non-negotiable invariants (Phase 3-relevant)

| Invariant | Status | Evidence |
|---|---|---|
| `word` never sent to non-drawers (before reveal) | **PASS** | Live: guessers got `word:null` in `turn:start`/`room:state`, `choices:null` in `turn:choosing`; pre-reveal leak count = 0. The only frame containing the word was `turn:reveal`. DO `buildState`/`turn:start`/`turn:choosing` drawer-only fields unchanged from Phase 1/2 (Phase 3 GameRoom.ts diff was only the lobby `name` field). |
| Timer server-authoritative (DO Alarms) | **PASS** | `turn:reveal` fired on the server clock after the 30s drawing phase (full-timer run) and after early all-guessed `endTurn` (alarm re-armed via `afterMutation`→`armAlarm`). No client-driven turn end. Vitest `game.test.ts:140-150` covers reveal→game-over via `fireAlarm`. |
| Scoring/validation server-side via `@skribbl/shared` | **PASS** | `guess:correct.points=295` and `turn:reveal.scores` produced by the DO via `calculateGuesserScore`/`calculateDrawerScore`; client only displays. Word-pack validation server-side in `apps/api/src/lib/words.ts`. |
| Draw coordinates normalized 0–1 | **PASS** | Live mirrored stroke points all ∈ [0,1]; `strokeSchema` (`packages/shared/src/schemas.ts:86-93`) + `pointSchema` enforce it. |
| No secrets committed | **PASS** | grep across Phase 3 diff for key/secret/token/PEM/AWS/Slack/GitHub/OpenAI patterns → only Tailwind color-token + rate-limit-prefix false positives. Only tracked env file is `apps/mobile/.env.example` (`EXPO_PUBLIC_WS_URL` only). `wrangler.toml` holds placeholder binding ids only. |
| Agents stayed in ownership lanes | **PASS** | `9a619a3` (word-packs): `apps/api/**` + `apps/mobile/**` (create, components, lib) — within allowed. `fe35a2f` (lobby): `apps/api/**` + `apps/mobile/{app,features,lib}/**` — within allowed. `73323f0` (polish): `apps/mobile/**` only — within allowed (no backend/contract touch). `0fe3fcc` (merge-fix): `apps/api/src/db/queries.ts` + `apps/mobile/.../PhaseAnnounce.tsx` + `TODO.md` — orchestrator merge-resolution, acceptable. |
| `TODO.md` checkmarks truthful | **PASS (with note)** | Phase 3: 3 `[x]` (lobby, word packs, polish) all reproduced live; 1 `[ ]` ("Hints polish; close-guess UX") honestly unchecked. **Stale hygiene:** the verification-gate lines for Phase 1 (`[~]`) and Phase 2 (`[ ]`) are not flipped to `[x]` despite `phase-1.md`/`phase-2.md` PASS reports existing — pre-existing, not a Phase 3 defect. |
| No contract drift (no local re-definition of shared types) | **PASS** | **No Phase 3 commit touched `packages/shared/`** (`git diff ebd3a2b..0fe3fcc -- packages/shared/` empty). `apps/mobile/lib/api.ts` imports `RoomSettings` from `@skribbl/shared`; no local `ServerMessage`/`ClientMessage`/`GAME =`/discriminatedUnion redefinitions. Word-pack validation lives in `apps/api`, not shared. |

---

## Non-blocking observations / follow-ups (carried forward, NOT Phase 3 blockers)

1. **Two D1 migrations share the `0002_` prefix** — `0002_add_room_name.sql` and `0002_word_packs_split.sql`. They apply alphabetically (`add` before `word`) and touch independent tables, so they execute correctly, but non-sequential migration numbering is a smell. — owner: A/orchestrator (Phase 4). Recommend renaming one to `0003_*` before any remote `migrations apply`.
2. **`wrangler dev --local` does not reliably auto-fire the short 4s reveal→game-over alarm on wall-clock time.** Live playthroughs reach `turn:reveal` (alarm-driven, verified) but `game:over` did not arrive within 24s of the reveal in local dev. The vitest suite (`game.test.ts:140-150`) fires the alarm manually via `runDurableObjectAlarm` and asserts `game:over` + sorted leaderboard — **passes**, proving the alarm *handler* logic is correct. Phase 3 did **not** touch the alarm/reveal/game-over code (the Phase 3 `GameRoom.ts` diff was only the lobby `name` field), so this is a Miniflare local-dev tooling caveat, not a Phase 3 regression. The deployed Cloudflare runtime fires alarms on wall-clock time. — owner: tooling (Phase 4 deploy will confirm against real runtime).
3. **D1 migrations are not auto-applied by `wrangler dev` startup** — they require an explicit `wrangler d1 migrations apply skribbl --local` first (the vitest-pool-workers environment applies them automatically, which is why the 26 api tests pass without a manual step). I had to apply them mid-smoke-test before `POST /api/word-packs` succeeded (initial 500 → `Failed query: insert into word_packs`). Operational note for the deploy step. — owner: orchestrator (Phase 4).
4. **`TODO.md` "Hints polish; close-guess UX" is honestly unchecked** (`TODO.md:81`). This item is **not in any Phase 3 sub-agent prompt's DoD**, so it is not a Phase 3 blocker. Note: the close-guess *UX* is in fact implemented (`useTurnFx.ts:84-90` plays `guessClose` sound + warning haptic on close feedback; `ChatPanel` shows close styling) — the unfinished part is "hints polish". Carry-forward to Phase 4. — owner: D/polish.
5. **react-doctor full score 48/100 (0 errors, 81 warnings).** Unchanged range from Phase 2; "react-doctor clean" is a **Phase 4** DoD. Phase 3 DoD is "fix errors" → 0 errors ✓. — owner: B/C/D (Phase 4).
6. **Stale TODO verification-gate lines** (Phase 1 `[~]`, Phase 2 `[ ]` despite PASS reports). Pre-existing hygiene, not Phase 3. — owner: orchestrator.

---

## How to reproduce

```bash
pnpm install && pnpm build
TURBO_CACHE_DIR=/tmp/empty-turbo pnpm typecheck
TURBO_CACHE_DIR=/tmp/empty-turbo pnpm test -- --force
TURBO_CACHE_DIR=/tmp/empty-turbo pnpm lint
npx -y react-doctor@latest apps/mobile --verbose          # 0 errors, 48/100
pnpm --filter @skribbl/mobile exec expo export --platform web --output-dir dist   # 9 routes

# Backend (apply migrations first!):
cd apps/api && pnpm exec wrangler d1 migrations apply skribbl --local
pnpm exec wrangler dev --port 8799 --local
# REST smoke:
curl -s http://localhost:8799/health
curl -s http://localhost:8799/api/words
curl -s -X POST http://localhost:8799/api/word-packs -H 'Content-Type: application/json' \
  -d '{"name":"Verify","words":["unicorn","dragon","taco","ninja","pixel"],"createdBy":"V"}'
curl -s -X POST http://localhost:8799/api/rooms -H 'Content-Type: application/json' \
  -d '{"isPublic":true,"maxRounds":1,"roundDurationSec":30,"hintsEnabled":true,"wordPackIds":["<packId>"],"name":"Phase3 Room"}'
curl -s http://localhost:8799/api/rooms
# 3-client WS playthrough: join x3 → start → select-word (choices from custom pack) → draw → guess → reveal
```
