/**
 * Agent D — game flow public API.
 *
 * The host route (`app/room/[id].tsx`) mounts {@link GameScreen} inside a
 * {@link GameDepsProvider} that supplies Agent B's theme + Agent C's
 * `<DrawCanvas/>` / `useRoomConnection`. Until those land, use
 * {@link StandaloneGameRoom}, which wires the stub deps against the mock.
 */

// Screens / mounts
export { GameScreen } from "./GameScreen";
export { StandaloneGameRoom } from "./StandaloneGameRoom";

// Dependency injection
export { GameDepsProvider, useGameDeps } from "./integration/GameDepsContext";
export type {
  DrawCanvasComponent,
  DrawCanvasProps,
  GameActions,
  GameDeps,
  GameSoundName,
  GameTheme,
  GameThemeColors,
  HapticsApi,
  RoomConnection,
  SoundApi,
  UseRoomConnection,
} from "./integration/contracts";

// Stub deps (development / pre-integration use)
export {
  createStandaloneGameDeps,
  noopHaptics,
  noopSound,
  StubDrawCanvas,
  stubDarkTheme,
  stubLightTheme,
  useStubRoomConnection,
} from "./integration/stubs";

// State layer (reducer + selectors + types) — reusable by Agent B's store
export { applyServerMessage, createInitialSnapshot, reduceMessages } from "./state/gameStore";
export * as gameSelectors from "./state/selectors";
export type {
  ConnectionStatus,
  Countdown,
  GuessFeedback,
  Identity,
  ReactionEvent,
  RoomSnapshot,
  ScoreRow,
} from "./state/types";
