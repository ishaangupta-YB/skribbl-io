# Handoff: Phase 3 — Public Lobby Browser (lobby-d1 agent)

**Status: DONE ✅** — backend D1 + KV public lobby registry is live, REST listing is
paginated and filtered, and the Expo app has a Lobby Browser screen.

## Backend changes (`apps/api`)

- D1 `lobby_rooms` registry now includes a `name` column (migration `0002_add_room_name.sql`).
- The `GameRoom` DO writes a `name` derived from the host nickname on every lifecycle
  change (e.g., `Alice's room`). If no host is present, it falls back to `Open room`.
- KV `lobby:public:list` cache has a 30-second TTL and is invalidated whenever a DO
  updates or removes its registry row.
- `GET /api/rooms` accepts `?status=open|joinable|all&page=N&limit=M` (default
  `status=joinable`, `page=1`, `limit=20`, max `limit=50`). It returns:
  ```json
  { "rooms": [...], "page": 1, "limit": 20, "total": 42 }
  ```
  Joinable rooms are public, in the `lobby` phase, non-empty, and not full. The response
  only includes public rooms — private rooms never leak.
- `POST /api/rooms` accepts an optional `name` field in the body and persists it to the
  registry before anyone joins.

## Frontend changes (`apps/mobile`)

- New route: `/lobby` (`app/lobby.tsx`) — the Public Lobby Browser.
- `features/lobby/`:
  - `useLobbyRooms` hook: fetches the public list, supports pull-to-refresh and a 10-second
    live refresh, plus pagination/load-more.
  - `RoomListItem` component: displays room name, host nickname, player count, status,
    and a Join action.
- The Home screen (`app/index.tsx`) now has a "Browse public rooms" button.
- The REST client (`lib/api.ts`) exposes `RoomMeta.name` and paginated
  `listPublicRooms(options)`.

## Join flow

Tapping **Join** on a browser row validates the nickname and navigates to
`/room/[id]`. The existing WS join flow takes over from there, so a browser join works
end-to-end against the real Worker.

## Contract / shared types

No `@skribbl/shared` changes were required. The `name` field is an extension to the REST
room summary only; the WebSocket protocol (`RoomSettings`, `PublicRoomState`) is unchanged.
If the Orchestrator wants room names to be editable in the future, a contract change to
add `name` to `RoomSettings` would be the next step.

## Verification

- `pnpm typecheck` — clean across all packages.
- `pnpm test` — 84 tests pass (shared 33, api 21, mobile 30).
- `pnpm lint` — clean.
- `react-doctor apps/mobile --diff` — 100/100, no issues.
