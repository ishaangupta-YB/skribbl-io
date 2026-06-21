# Handoff: Canvas + Realtime Integration (Agent C → B & D)

**Status: READY (built against the contract + mock; not yet wired to B's scaffold).**

Agent C delivered the realtime WS client (`apps/mobile/lib/realtime`) and the
Skia drawing board (`apps/mobile/features/canvas`). Both are built and verified
against `@skribbl/shared` + the mock server. Because B's Expo scaffold had not
landed in C's worktree, a few integration points need B/D action — listed below.

## What C shipped

- `lib/realtime/` — typed, self-healing WebSocket client:
  - `RoomConnection` (framework-agnostic): join-first handshake, **every** inbound
    frame validated with `parseServerMessage`, typed `send*` helpers via `encode`,
    exponential-backoff auto-reconnect, `ping`/`pong` heartbeat
    (`GAME.HEARTBEAT_INTERVAL_MS`).
  - `useRoomConnection(roomId, identity)` — React hook → returns `{ status, youId,
    connection, send, start, selectWord, sendDraw, clear, undo, sendChat, react,
    leave }` and forwards every frame into the store.
  - `useRoomStore` (zustand) — **provisional shared store** (see "Store" below).
- `features/canvas/` — `DrawingBoard`, `DrawCanvas`, `Toolbar`, `useDrawingBoard`,
  `CanvasKitProvider` (+ `.native` no-op), normalized-coord + batching helpers.

## ACTION — Agent B

1. **Install deps** (per `apps/mobile/README.md`): `@shopify/react-native-skia`,
   `react-native-gesture-handler`, `react-native-reanimated`, `zustand`,
   `@skribbl/shared`. Add `react-native-gesture-handler` import + a
   `<GestureHandlerRootView style={{flex:1}}>` at the app root, and the
   `react-native-reanimated/plugin` in `babel.config.js`.
2. **Web/CanvasKit:** wrap the web app in `<CanvasKitProvider>` (see
   `features/canvas/README.md`). No-op on native.
3. **Store ownership:** C placed a provisional `useRoomStore` in
   `lib/realtime/store.ts` (you own `lib/store`). Either (a) re-export/move it to
   `lib/store` and keep `lib/realtime` importing it, or (b) tell C the canonical
   store path/actions and C will point at it. The store reducer
   (`applyServerMessage`) is the single place that turns frames into state — keep
   that shape if you adapt it. **Do not fork it.**
4. **tsconfig/eslint/metro:** exclude `**/__verify__/**` from the app build
   (`"exclude": ["**/__verify__/**"]`) — those are standalone tsx scripts.

## ACTION — Agent D

- Mount the board in the game route:
  ```tsx
  const room = useRoomConnection(roomId, identity);
  <DrawingBoard connection={room.connection} />
  ```
- Read game state from the store (selectors exported from `lib/realtime`):
  `selectRoom`, `selectPlayers`, `selectChat`, `selectScores`, `selectStatus`,
  `selectStrokes`, `selectCanDraw`. Word-choice UI uses `room.wordChoices`
  (drawer-only) and `room.word`/`maskedWord`; countdown from `room.phaseEndsAt`.
- Subscribe to one-off events for FX via `room.connection.on("guess:correct", …)`,
  `"turn:reveal"`, `"react"`, `"game:over"` if you want animations beyond store state.

## Store shape (provisional, `useRoomStore`)

`status`, `youId`, `room: PublicRoomState | null`, `chat: ChatMessage[]`,
`scores: ScoreEntry[]`, `leaderboard`, `lastReaction`, `lastError`,
`strokes: Stroke[]`. Actions: `applyServerMessage`, `applyDraw`, `clearStrokes`,
`undoStroke`, `resetStrokes`, `setStatus`, `reset`.

## Canvas component contract

- `<DrawingBoard connection showToolbar? backgroundColor? style? emitIntervalMs? />`
- `<DrawCanvas strokes current enabled backgroundColor? onStrokeStart onStrokeMove onStrokeEnd style? />`
  — points passed to callbacks are already **normalized [0,1]**.
- Drawing is gated by `selectCanDraw` (drawer + `phase==="drawing"`). Guessers
  see a live read-only mirror.

## Contract notes / no changes requested

C did **not** need any protocol change — the frozen `@skribbl/shared` contract
covers the canvas + realtime needs. One observation for later (not a blocker):
`draw` frames carry no stroke id, so C reconstructs full strokes from streamed
segments by overlapping one boundary point; this keeps `draw:undo` consistent
across clients. If a future version wants per-stroke undo semantics, add an
optional stroke id — raise via `docs/handoffs/contract.md`.

## Verified by C

- `RoomConnection` end-to-end vs mock (drawer+guesser): join handshake, frame
  validation, anti-cheat masking (word hidden from guesser), **draw mirroring**,
  correct-guess scoring, ping/pong, auto-reconnect — 20/20 checks pass.
- Drawing logic (coords, throttled batching, segment reconstruction) — all pass.
- RN/Skia/gesture-handler/zustand UI typechecks against the real libraries
  (Skia 1.5, gesture-handler 2.20, React 18.3, zustand 5).
- ESLint clean on `apps/mobile`.
- **Pending B's scaffold:** visual two-browser-tab playthrough and
  `react-doctor` (need the runnable Expo app).
