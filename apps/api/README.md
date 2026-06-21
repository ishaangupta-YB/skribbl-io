# apps/api — Cloudflare Worker + Durable Object (Agent A)

The real-time game backend. Owned by **Agent A**. Build against the frozen contract in `@skribbl/shared` and match the behaviour of `tools/mock-ws-server`.

## Scaffold (first steps)

```bash
# from skribbl-cloud/apps/api
pnpm create cloudflare@latest . --type=hello-world --ts --no-deploy
pnpm add hono @skribbl/shared drizzle-orm
pnpm add -D wrangler @cloudflare/vitest-pool-workers drizzle-kit vitest typescript
```

Name the package `@skribbl/api` and add scripts:

```jsonc
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "wrangler d1 migrations apply skribbl"
  }
}
```

## `wrangler.toml` (bindings)

```toml
name = "skribbl-api"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "GAME_ROOM"
class_name = "GameRoom"

[[migrations]]
tag = "v1"
new_classes = ["GameRoom"]   # use new_sqlite_classes if using the SQLite DO storage

[[d1_databases]]
binding = "DB"
database_name = "skribbl"
database_id = "<from: wrangler d1 create skribbl>"

[[kv_namespaces]]
binding = "KV"
id = "<from: wrangler kv namespace create skribbl-kv>"
```

## What to build (see `TODO.md` Phase 1A)

- **Hono router** (`src/index.ts`): REST (`/api/rooms`, `/api/words`) + WS upgrade at `/api/rooms/:id/ws` that forwards to the DO via `env.GAME_ROOM.idFromName(roomId)`.
- **`GameRoom` Durable Object** (`src/durable/GameRoom.ts`):
  - Accept WebSockets with the **Hibernation API** (`state.acceptWebSocket(ws)` + `webSocketMessage`/`webSocketClose` handlers).
  - Hold authoritative state; persist to `state.storage`.
  - Drive `choosing → drawing → reveal → next/over` with **`state.storage.setAlarm`**.
  - Use `@skribbl/shared`: `parseClientMessage`, scoring, `maskWord`/`revealLetters`, `advanceTurn`, `phaseDurationSec`, `getRandomWords`/`collectWords`, `encode`.
  - **Never** send `word` to non-drawers (use `maskedWord`/`wordLength`).
- **D1 + Drizzle**: word packs + public lobby registry; merge custom packs at room start.
- **KV**: cache public lobby list; basic rate limiting.

## Done =

- Matches the mock's observable behaviour, passes Vitest, `wrangler dev` serves WS.
- Fill in `docs/handoffs/backend-ready.md`.
