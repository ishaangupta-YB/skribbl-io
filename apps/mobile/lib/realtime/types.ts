import type { Avatar, ServerMessage } from "@skribbl/shared";

/**
 * Minimal structural type for a WebSocket so {@link RoomConnection} does not
 * hard-depend on the DOM lib. The browser `WebSocket`, React Native's
 * `WebSocket`, and Node 22's global `WebSocket` all satisfy this shape.
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

/** `WebSocket.OPEN` — inlined so we never touch a global at module scope. */
export const WS_OPEN = 1;

/** Identity the local player joins a room with. */
export interface Identity {
  nickname: string;
  avatar: Avatar;
}

/**
 * Connection lifecycle, surfaced to the UI for status chips / spinners.
 * - `idle`        — created but not yet connected
 * - `connecting`  — first socket attempt in flight
 * - `open`        — socket open and `join` sent
 * - `reconnecting`— dropped; backing off before the next attempt
 * - `closed`      — closed by the app (`disconnect()`); will not retry
 */
export type ConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface RoomConnectionOptions {
  roomId: string;
  identity: Identity;
  /** Defaults to `EXPO_PUBLIC_WS_URL` (or `ws://localhost:8787`). */
  baseUrl?: string;
  /** Injectable socket factory; defaults to `globalThis.WebSocket`. Handy for tests. */
  socketFactory?: WebSocketFactory;
  /** Disable automatic reconnect (default: enabled). */
  autoReconnect?: boolean;
  /** Override the heartbeat interval (defaults to `GAME.HEARTBEAT_INTERVAL_MS`). */
  heartbeatIntervalMs?: number;
}

/**
 * The event surface consumed by the React layer. Each server message becomes a
 * strongly-typed event; `status` and `parse-error` are connection-level extras.
 *
 * Every payload is the already-validated body of a {@link ServerMessage}, so
 * `Extract<ServerMessage, { type: T }>` keeps these in lockstep with the
 * frozen contract — adding a server message type surfaces here as a type error.
 */
export type RoomEvents = {
  status: ConnectionStatus;
  /** Every validated inbound frame (used to drive the store in one place). */
  message: ServerMessage;
  /** An inbound frame that failed `parseServerMessage` (kept for diagnostics). */
  "parse-error": { raw: unknown; error: string };
} & {
  [M in ServerMessage as M["type"]]: M;
};
