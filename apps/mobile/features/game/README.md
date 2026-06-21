# features/game — in-game flow (Agent D)

The complete in-game experience: choose → draw → guess → reveal → leaderboard,
driven entirely by the server frames defined in `@skribbl/shared`.

> **Status:** built ahead of Agent B's Expo scaffold and Agent C's canvas/WS
> client. It runs **today** against the mock via stub dependencies. When B/C
> land, swap the stubs for the real theme + `<DrawCanvas/>` + `useRoomConnection`
> — the contracts below are all that's required.

## Architecture

```
state/            pure, framework-agnostic (depends only on @skribbl/shared)
  types.ts          RoomSnapshot + derived view-model types
  gameStore.ts      applyServerMessage() reducer — folds ServerMessage → RoomSnapshot
  selectors.ts      countdown, scoreboard, word display, input-lock, host/drawer
  *.test.ts         30 vitest cases incl. a live 3-client mock playthrough
integration/      the seam to the rest of the app (React)
  contracts.ts      GameDeps: GameTheme, UseRoomConnection, DrawCanvas, Haptics, Sound
  GameDepsContext   provider + hooks (useTheme/useHaptics/useSound/…)
  stubs.tsx         standalone theme, WS connection (reference impl), canvas, fx
hooks/            useNow, useCountdown, useTurnFx (sound+haptics), useActiveReactions
components/       GameHeader, WordBanner, WordChoiceModal, CanvasStage, ChatPanel,
                  Scoreboard, TurnRevealOverlay, GameOverScreen, Confetti,
                  ReactionsLayer, ReactionBar, LobbyView, ConnectionBanner, primitives
GameScreen.tsx    phase-routed, responsive composition (mounted by app/room/[id].tsx)
StandaloneGameRoom.tsx  self-wired with stub deps (works against `pnpm mock` now)
index.ts          public API
```

The **state layer is the heart**: the same `applyServerMessage` reducer powers
the UI, the tests, and the reference WS client. It is the canonical local mirror
of a room and a drop-in reference for the store Agent B/C maintain.

## How the host mounts it (`app/room/[id].tsx`, owned by B)

```tsx
import { GameScreen, GameDepsProvider, type GameDeps } from "../../features/game";

const deps: GameDeps = {
  theme,                 // map B's theme tokens → GameTheme (see contracts.ts)
  useRoomConnection,     // C's hook → { status, snapshot, actions }
  DrawCanvas,            // C's <DrawCanvas editable={boolean} />
  haptics,               // expo-haptics wrapper (HapticsApi)
  sound,                 // expo-av wrapper (SoundApi)
  identity,              // B's useIdentity() → { nickname, avatar }
  onLeave: () => router.back(),
};

export default function RoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <GameDepsProvider deps={deps}>
      <GameScreen roomId={id} />
    </GameDepsProvider>
  );
}
```

Until B/C are merged, use the zero-config version:

```tsx
import { StandaloneGameRoom } from "../../features/game";
<StandaloneGameRoom roomId={id} onLeave={() => router.back()} />;
```

## What Agent D needs from B & C (the contract)

- **B → `GameTheme`** (tokens only — colors, `spacing(n)`, `radius`, `font`). D
  ships its own minimal primitives, so it does **not** depend on B's Button/Card
  APIs; just the tokens. See `integration/contracts.ts`.
- **B → `Identity`** (`{ nickname, avatar }`) and optional expo-haptics/expo-av
  wrappers (`HapticsApi`, `SoundApi`). D injects no-ops by default.
- **C → `useRoomConnection(roomId, identity)`** returning
  `{ status, snapshot: RoomSnapshot, actions }` where `actions` = `start`,
  `selectWord`, `sendChat`, `react`, `leave`. `snapshot` is the
  `applyServerMessage` reducer output (C may reuse `gameStore.ts` directly).
- **C → `<DrawCanvas editable={boolean} style />`** — Skia canvas; D mounts it
  and toggles `editable` for the active drawer only.

If your real shapes differ, write a thin adapter in `app/room/[id].tsx` rather
than changing the contract here, and note it in
`docs/handoffs/frontend-integration.md`.

## Run it against the mock

```bash
pnpm install && pnpm build      # repo root
pnpm mock                       # ws://localhost:8787
# then, in the Expo app, mount <StandaloneGameRoom roomId="ABCDEF" />
# open 2–3 tabs to play drawer + guessers through to the leaderboard.
```

## Tests

```bash
node_modules/.bin/vitest run --config apps/mobile/features/game/vitest.config.ts
```

- Deterministic reducer/selector suite (mirrors every mock frame).
- **Live end-to-end playthrough** (`playthrough.e2e.test.ts`): boots the real
  mock, runs 3 WebSocket clients through a full game, and asserts the
  anti-cheat invariant (a guesser never holds the real word while drawing).

> Animations use React Native's built-in `Animated` API (no extra dep) so the
> feature stays decoupled; they can be upgraded to Reanimated/Moti later.
