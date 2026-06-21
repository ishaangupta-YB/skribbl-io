import { generateRoomId } from "@skribbl/shared";

/**
 * Backend base URL. During Phase 1 this points at the local protocol mock
 * (`pnpm mock`); in Phase 2 it switches to `wrangler dev` / the deployed Worker.
 * The WS client (Agent C) builds the room socket URL from this.
 */
export const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8787";

/** Full WebSocket URL for a room's Durable Object. */
export function roomWsUrl(roomId: string): string {
  return `${WS_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}/ws`;
}

/** Suggest a shareable room code (server remains authoritative). */
export function suggestRoomId(): string {
  return generateRoomId();
}
