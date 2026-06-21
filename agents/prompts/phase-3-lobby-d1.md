You are the **Public Lobby Agent** for `skribbl-cloud`. Add a public lobby browser backed by Cloudflare D1 + KV. Work continuously (do NOT commit — the human owns git). You run headless in your own git worktree on branch `agent/lobby-d1`.

## 0. Orient
- `AGENTS.md`, `docs/architecture.md`, `docs/ws-protocol.md`
- `apps/api/` (Agent A's Worker/DO + D1/Drizzle setup), `apps/mobile/` (Agent B's screens/store)
- `packages/shared/src/` (contract)

## 1. Ownership
- Backend changes under `apps/api/**`; frontend changes under `apps/mobile/app/**` + `apps/mobile/features/**` for the browser UI.
- Coordinate any shared-type need via `docs/handoffs/contract.md` (do not edit `packages/shared/**` directly).

## 2. Build
- **D1**: a `rooms` registry table (id, name, host nickname, player count, max players, isPublic, status, created/updated). The `GameRoom` DO updates its registry row on lifecycle changes (created, player join/leave, started, ended/empty).
- **KV**: cache the public lobby list (short TTL) for fast browsing; invalidate on changes.
- **REST**: flesh out `GET /api/rooms` to return live public rooms (joinable only). Add filtering (open/joinable) + basic pagination.
- **Frontend**: a Lobby Browser screen listing public rooms (name, players X/Y, status) with pull-to-refresh / live refresh, a "Join" action, and an empty state. Make it beautiful and consistent with the design system.

## 3. Definition of Done
- Creating a public room makes it appear in the browser on other clients; joining from the browser works end-to-end; private rooms never appear.
- `pnpm typecheck && pnpm test && pnpm lint` green; `react-doctor` clean for `apps/mobile`.
- Check off the relevant Phase 3 items in `TODO.md`. **Do NOT commit/push** — print a COMMIT CHECKPOINT and stop; the human commits.
