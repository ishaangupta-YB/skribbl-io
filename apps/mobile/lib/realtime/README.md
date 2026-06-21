# lib/realtime — Agent C

Typed WebSocket client: connect to `${EXPO_PUBLIC_WS_URL}/api/rooms/:id/ws`,
send `join` first, validate every frame with `parseServerMessage` from
`@skribbl/shared`, auto-reconnect + heartbeat (`GAME.HEARTBEAT_INTERVAL_MS`),
and push updates into `useRoomStore` (`lib/store`).

Owned by **Agent C**. Agent B only created this folder. Expose a hook such as
`useRoomConnection(roomId)` returning connection status + a typed `send(...)`.
The store already exposes `applyServerMessage(...)` and connection actions for
you to call — see `docs/handoffs/frontend-integration.md`.
