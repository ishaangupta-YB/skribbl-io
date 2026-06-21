/**
 * `lib/realtime` — typed WebSocket client for the skribbl game room.
 *
 * - {@link RoomConnection}: framework-agnostic socket (join-first, zod-validated,
 *   auto-reconnect, heartbeat). Unit-tested against the mock in `__verify__/`.
 * - {@link useRoomConnection}: React hook wiring a connection into the store.
 * - {@link useRoomStore}: provisional shared room/drawing store (see handoff).
 */
export { RoomConnection } from "./RoomConnection";
export { useRoomConnection } from "./useRoomConnection";
export type { RoomConnectionHandle } from "./useRoomConnection";
export {
  useRoomStore,
  selectStatus,
  selectRoom,
  selectPlayers,
  selectChat,
  selectScores,
  selectStrokes,
  selectCanDraw,
} from "./store";
export type { RoomStore, ReactionEvent } from "./store";
export { buildRoomWsUrl, getWsBaseUrl, DEFAULT_WS_BASE_URL } from "./url";
export { Emitter } from "./emitter";
export type {
  ConnectionStatus,
  Identity,
  RoomConnectionOptions,
  RoomEvents,
  WebSocketLike,
  WebSocketFactory,
} from "./types";
