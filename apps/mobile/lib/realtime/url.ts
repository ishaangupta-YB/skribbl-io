/**
 * Builds the room WebSocket URL from the public env var.
 *
 * The Expo client connects to `${EXPO_PUBLIC_WS_URL}/api/rooms/:roomId/ws`
 * (mock during Phase 1, `wrangler dev` in Phase 2). `EXPO_PUBLIC_*` vars are
 * statically inlined by Metro, so `process.env.EXPO_PUBLIC_WS_URL` is safe on
 * every platform.
 */
export const DEFAULT_WS_BASE_URL = "ws://localhost:8787";

function readEnvBaseUrl(): string | undefined {
  // Keep this exact member expression so Expo/Metro statically inlines it.
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env.EXPO_PUBLIC_WS_URL;
}

export function getWsBaseUrl(override?: string): string {
  const base = override ?? readEnvBaseUrl() ?? DEFAULT_WS_BASE_URL;
  // Trim a trailing slash so we never produce `...//api/rooms`.
  return base.replace(/\/+$/u, "");
}

export function buildRoomWsUrl(roomId: string, baseUrl?: string): string {
  return `${getWsBaseUrl(baseUrl)}/api/rooms/${encodeURIComponent(roomId)}/ws`;
}
