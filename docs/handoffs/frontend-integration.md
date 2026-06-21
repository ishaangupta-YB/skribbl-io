# Handoff: Frontend Integration (Agent B → C & D)

**Status: NOT STARTED** — Agent B fills this in once the Expo scaffold + design system land.

Template to complete:

## Scaffold

- [ ] Expo app created (`apps/mobile`), runs on web/iOS/Android
- [ ] Expo Router structure (list the routes)
- [ ] NativeWind configured; theme tokens exported from `____`
- [ ] Folders created for other agents: `features/canvas/` (C), `features/game/` (D), `lib/realtime/` (C)

## Conventions

- Design tokens / theme location: `____`
- UI components available (Button, Input, Card, Modal, Avatar, …): `____`
- Zustand store(s) + selectors: `____`
- Env var for backend: `EXPO_PUBLIC_WS_URL` (mock default `ws://localhost:8787`)

## How C plugs in

- WS client lives in `lib/realtime`; expose a hook (e.g. `useRoomConnection(roomId)`).
- Canvas component contract (props/events): `____`

## How D plugs in

- Game screen mounts canvas (C) + chat/score panels; reads room store.
- Where to add the game route: `____`

## Run

```bash
pnpm install && pnpm build && pnpm mock   # terminal 1
pnpm --filter @skribbl/mobile dev          # terminal 2 (web)
```

---

## Agent D — required interfaces (added by D; B/C please conform or adapt)

Agent D's game flow (`apps/mobile/features/game/**`) is built and tested ahead of
the scaffold. It is fully decoupled via an injected `GameDeps` bundle
(`features/game/integration/contracts.ts`). D needs **only** the following from
B and C — if your real shapes differ, add a thin adapter in `app/room/[id].tsx`;
don't change `@skribbl/shared`.

**From B (design system / app):**
- `GameTheme` **tokens** (not components): `colors` (background, surface,
  surfaceAlt, card, border, text, textMuted, textInverse, primary, primaryText,
  accent, success, danger, warning, info, correct, close, system, overlay),
  `spacing(n)` (4px scale), `radius`, `font`. D renders its own minimal
  primitives from these tokens, so it does **not** depend on B's Button/Card API.
- `Identity` = `{ nickname, avatar: { emoji, color } }` (from `useIdentity`).
- Optional `HapticsApi` (expo-haptics) + `SoundApi` (expo-av) wrappers; D
  defaults to no-ops.
- Mount point: `app/room/[id].tsx` wraps `<GameScreen roomId>` in
  `<GameDepsProvider deps={…}>`. Until C lands, `<StandaloneGameRoom roomId/>`
  works against the mock with zero wiring.

**From C (canvas / realtime):**
- `useRoomConnection(roomId, identity)` → `{ status, snapshot: RoomSnapshot, actions }`
  where `actions` = `{ start, selectWord, sendChat, react, leave }`.
  - `RoomSnapshot` + the `applyServerMessage` reducer that produces it live in
    `features/game/state/` and are exported from `@/features/game` — **C is
    welcome to reuse them directly** so the store shape matches exactly.
- `<DrawCanvas editable={boolean} style />` — D mounts it in `CanvasStage` and
  sets `editable` true only for the active drawer.

D handles all of: HUD/countdown, word area + hints, word-choice modal, chat/guess
panel (per-kind styling + lock + close-nudge), live scoreboard, turn-reveal
overlay, game-over leaderboard + confetti, reactions, lobby/connection states.
