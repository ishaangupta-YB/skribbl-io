# Handoff: Backend Ready (Agent A → integration)

**Status: READY ✅** — `apps/api` (the Cloudflare Worker + `GameRoom` Durable Object) is
runnable and reproduces the `tools/mock-ws-server` behaviour against real Cloudflare
primitives (DO + WebSocket Hibernation + Alarms + D1 + KV).

It speaks the exact `@skribbl/shared` protocol, so anything built against the mock works
unchanged — just point `EXPO_PUBLIC_WS_URL` at `wrangler dev` instead of the mock.

## Endpoints

- [x] `POST /api/rooms` → `{ roomId, settings }` (body: partial `RoomSettings`; per-IP rate limited)
- [x] `GET /api/rooms` → `{ rooms: RoomSummary[] }` (public, joinable lobby list; KV-cached)
- [x] `GET /api/rooms/:id` → `{ exists, room }` (404 `{ exists:false }` if unknown)
- [x] `GET /api/words` → `{ packs }` (bundled `@skribbl/shared` packs + any D1 custom packs)
- [x] `GET /api/rooms/:id/ws` → WebSocket upgrade → `GameRoom` DO (`idFromName(roomId)`)
- `GET /health` → `{ ok:true }`

`POST` body example: `{"maxRounds":3,"roundDurationSec":70,"isPublic":true,"wordPackIds":["default"],"hintsEnabled":true}`.
All fields optional; unknown/invalid values are rejected with `400`. Room codes use
`generateRoomId` (uppercase, `roomIdSchema`-valid).

## WebSocket protocol

Identical to the mock and `docs/ws-protocol.md`:

- First client frame **must** be `join`; anything else → `error { code:"NOT_ALLOWED" }`.
- Unparseable frames → `error { code:"INVALID_MESSAGE" }`; full room → `error { code:"ROOM_FULL" }`.
- Server sends personalised `room:state` / `turn:choosing` / `turn:start`: the full `word`
  and `wordChoices` go **only** to the drawer; guessers get `maskedWord` + `wordLength`.
- The turn timer is server-authoritative (DO **Alarms**); clients render from `phaseEndsAt`.
- Scoring / guess validation / hints / close-guess all run server-side via `@skribbl/shared`.

The room id in the URL is upper-cased before `idFromName`, matching the mock (`/api/rooms/<ID>/ws`).

## Local dev

```bash
pnpm install && pnpm build                       # build @skribbl/shared first
pnpm --filter @skribbl/api db:migrate:local      # apply D1 migrations to the local DB (optional; code degrades gracefully)
pnpm --filter @skribbl/api dev                    # wrangler dev (defaults to http://127.0.0.1:8787)
# or pin a port:
pnpm --filter @skribbl/api exec wrangler dev --port 8799
```

- Local WS URL: `ws://127.0.0.1:8787/api/rooms/<ID>/ws` (or `8799` if you pinned the port).
- REST base: `http://127.0.0.1:8787`
- Bindings configured: [x] Durable Object (`GAME_ROOM`)  [x] D1 (`DB`)  [x] KV (`KV`)

Tests: `pnpm --filter @skribbl/api test` (Workers Vitest pool; 18 tests). Typecheck/lint:
`pnpm typecheck && pnpm lint` (clean across the workspace).

## Before deploying (human)

`wrangler.toml` has placeholder ids. Provision real resources and paste the ids:

```bash
cd apps/api
wrangler d1 create skribbl            # → set database_id
wrangler kv namespace create skribbl-kv   # → set [[kv_namespaces]].id
wrangler d1 migrations apply skribbl  # apply schema + seed packs (remote)
```

## Deviations from the contract / mock

- **None at the protocol level.** Every client/server frame matches `@skribbl/shared` and the mock.
- **Hints** are alarm-driven (one letter per scheduled tick between 50%→100% of the draw time),
  rather than the mock's `setInterval` recomputing a count. The observable result is the same:
  guessers receive progressive `turn:hint` updates (drawer excluded), capped at `maxHintLetters`.
- **Empty room** resets the DO to a fresh lobby (preserving roomId/settings) instead of deleting a
  map entry — the same effect for clients (a reconnect to the code gets a clean lobby).

## Known limitations / TODO (post-Phase 1)

- **No reconnection grace yet:** a socket close removes the player immediately (mirrors the mock).
  `GAME.RECONNECT_GRACE_MS` is unused for now.
- **Strokes are not persisted/replayed:** the DO mirrors `draw`/`draw:clear`/`draw:undo` live but
  does not store the canvas, so a client joining mid-draw starts from a blank canvas (same as mock).
- **Lobby registry is best-effort:** D1/KV writes from the DO are fire-and-forget and wrapped in
  try/catch; a registry failure never affects gameplay. `GET /api/rooms` is eventually consistent
  (≈30s KV cache, invalidated on room changes).
- **Rate limiting is coarse** (KV-based, ~15 room creates / IP / minute, fail-open).
- R2 replay snapshots: not wired (out of scope for Phase 1).
