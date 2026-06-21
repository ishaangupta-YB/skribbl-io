# Handoff: Backend Ready (Agent A → integration)

**Status: NOT STARTED** — Agent A fills this in when `apps/api` is runnable.

Template to complete:

## Endpoints

- [ ] `POST /api/rooms` → `{ roomId }` (body: partial `RoomSettings`)
- [ ] `GET /api/rooms` → public lobby list
- [ ] `GET /api/rooms/:id` → exists/meta
- [ ] `GET /api/words` → available word packs
- [ ] `GET /api/rooms/:id/ws` → WebSocket upgrade → `GameRoom` DO

## Local dev

```bash
# command(s) to run the worker + DO locally, e.g.
pnpm --filter @skribbl/api dev      # wrangler dev on http://localhost:8788
```

- Local WS URL: `ws://localhost:____/api/rooms/<ID>/ws`
- Bindings configured: [ ] Durable Object  [ ] D1  [ ] KV

## Deviations from the contract / mock

- _List any differences the frontend must know about (ideally none)._

## Known limitations / TODO

- _e.g. reconnection grace, rate limiting, R2 replays not yet wired._
