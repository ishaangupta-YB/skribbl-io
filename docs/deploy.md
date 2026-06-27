# Deploy Runbook — skribbl-cloud

> This runbook documents the **one-command, repeatable deploy** for the Cloudflare backend, the Cloudflare Pages web app, and the EAS mobile builds.
> **Secrets live in Cloudflare dashboard / GitHub secrets / EAS environment only — never in code.**

---

## What gets deployed

| Component    | Platform                             | Entry command                                       | Output                                      |
| ------------ | ------------------------------------ | --------------------------------------------------- | ------------------------------------------- |
| API backend  | Cloudflare Workers + Durable Objects | `wrangler deploy`                                   | `https://skribbl-api.<account>.workers.dev` |
| D1 database  | Cloudflare D1                        | `wrangler d1 migrations apply skribbl`              | SQLite edge DB                              |
| KV namespace | Cloudflare KV                        | bound in `wrangler.toml`                            | lobby cache + rate limit                    |
| Web app      | Cloudflare Pages                     | `expo export -p web` + `wrangler pages deploy dist` | `https://skribbl-io.pages.dev`              |
| Mobile app   | EAS (Expo Application Services)      | `eas build --profile production`                    | TestFlight / Play internal testing          |

---

## 0. Deploy model — Cloudflare Dashboard Git integration (PRIMARY)

> Production deploys are driven by **Cloudflare's GitHub integration**, configured
> entirely in the Cloudflare dashboard. **No CLI and no GitHub Actions are needed
> to deploy.** `.github/workflows/deploy.yml` is a manual fallback only (it does
> not run on push). `ci.yml` still runs the full test suite on every push/PR.
>
> **Deploy branch: `main`.** Cloudflare rebuilds and redeploys on every push to `main`.

### Worker (API) — "Workers" → Connect to Git (Workers Builds)

Dashboard → **Workers & Pages → Create → Workers → Connect to Git** → pick the repo, production branch **`main`**:

| Setting           | Value                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| Worker name       | `skribbl-api` (must match `name` in `apps/api/wrangler.toml`)              |
| Production branch | `main`                                                                     |
| Root directory    | `apps/api`                                                                 |
| Build command     | `pnpm install --frozen-lockfile && pnpm --filter @skribbl/shared build`    |
| Deploy command    | `npx wrangler d1 migrations apply skribbl --remote && npx wrangler deploy` |

The deploy command applies D1 migrations (in order, idempotently) **before** deploying the Worker. Node 22 is auto-selected from the repo `.nvmrc`. Bindings (Durable Object, D1, KV) and `[vars]` come from `wrangler.toml` — there is nothing to configure in the dashboard for those. First deploy prints `https://skribbl-api.<account>.workers.dev`.

### Web app — "Pages" → Connect to Git

Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo, branch **`main`**:

| Setting                | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Project name           | `skribbl-io` (→ `https://skribbl-io.pages.dev`)                |
| Production branch      | `main`                                                         |
| Framework preset       | None                                                           |
| Root directory         | `/` (repo root — required for the pnpm workspace)              |
| Build command          | `pnpm build && pnpm --filter @skribbl/mobile run export:web`   |
| Build output directory | `apps/mobile/dist`                                             |
| Environment variable   | `EXPO_PUBLIC_WS_URL = wss://skribbl-api.<account>.workers.dev` |

`EXPO_PUBLIC_WS_URL` is **inlined into the JS bundle at build time** — it is a public value, not a secret. Set it under the Pages project's **Settings → Variables and Secrets → Production** (and Preview if you use preview deploys), then trigger a redeploy.

### D1 + KV provisioning + migrations

1. **D1:** Storage & Databases → D1 → **Create** → name `skribbl`. Copy the **Database ID** into `apps/api/wrangler.toml` `[[d1_databases]] database_id`.
2. **KV:** Storage & Databases → KV → **Create namespace** → name `skribbl-kv`. Copy the **ID** into `wrangler.toml` `[[kv_namespaces]] id`.
3. **Schema (automatic):** the Worker **Deploy command** runs `wrangler d1 migrations apply skribbl --remote` first, so the four migrations apply in order and are tracked in `d1_migrations` (idempotent across deploys). **Do not paste the migration SQL by hand** — the dashboard console does not enforce file order, so running `0003` before `0001` throws `Error: no such table: word_packs`.
4. **If you already ran SQL by hand and hit an error,** reset the DB once in D1 → `skribbl` → **Console**, then let the next deploy re-apply cleanly:
   ```sql
   DROP TABLE IF EXISTS words;
   DROP TABLE IF EXISTS word_packs_new;
   DROP TABLE IF EXISTS word_packs;
   DROP TABLE IF EXISTS lobby_rooms;
   DROP TABLE IF EXISTS d1_migrations;
   ```
5. The Durable Object SQLite class migration (`[[migrations]] tag = "v1"`) is applied automatically on the first Worker deploy.

### CORS for public launch (required)

Set `ALLOWED_ORIGINS` in `wrangler.toml [vars]` to the exact web origin(s) before launch (commit → Worker redeploys):

```toml
ALLOWED_ORIGINS = "https://skribbl-io.pages.dev"
```

Add a comma-separated custom domain if used. WebSocket upgrades skip CORS; REST endpoints (create/list room) are origin-checked, so this MUST include the Pages origin or the web app's REST calls fail.

### Order of operations

1. Provision D1 + KV, paste IDs into `wrangler.toml`, commit to `main`.
2. Connect the **Worker** to Git → deploy. The deploy command runs `wrangler d1 migrations apply skribbl --remote` first (applies all 4 migrations in order, idempotently), then `wrangler deploy`. Copy the `…workers.dev` URL.
3. Connect **Pages** to Git, set `EXPO_PUBLIC_WS_URL` to `wss://…workers.dev` → deploy → copy the `…pages.dev` URL.
4. `ALLOWED_ORIGINS` is already set to `https://skribbl-io.pages.dev` in `wrangler.toml` — the Worker deploy in step 2 picks it up automatically. If you rename the Pages project or add a custom domain, update it and redeploy.

---

## Prerequisites (only for the optional manual/local CLI path below)

- A Cloudflare account with **Workers + D1 + KV + Pages** enabled.
- `wrangler` CLI authenticated: `npx wrangler login`.
- `pnpm` 9.12.3+ and Node 22.
- For mobile: an EAS account + `eas login` (or `EXPO_TOKEN` in CI).

---

## 1. Provision Cloudflare resources

Run these **once** from `apps/api/`.

```bash
cd apps/api

# 1. D1 database
npx wrangler d1 create skribbl
# Copy the returned `database_id` into `wrangler.toml` under [[d1_databases]].

# 2. KV namespace
npx wrangler kv namespace create skribbl-kv
# Copy the returned `id` into `wrangler.toml` under [[kv_namespaces]].

# 3. Durable Object migration (already declared in wrangler.toml as v1)
# No manual creation needed — first deploy will apply it.
```

No `wrangler secret` values are required for the backend. The only runtime env var is `ALLOWED_ORIGINS` (see CORS below).

---

## 2. Deploy the backend

```bash
cd apps/api

# Apply D1 migrations
npx wrangler d1 migrations apply skribbl

# Deploy Worker + Durable Object bindings
npx wrangler deploy
```

After deploy, Wrangler prints the Worker URL, e.g.:

```
https://skribbl-api.<your-account>.workers.dev
```

**Note the production WSS/HTTPS origin.** The client must use:

```
wss://skribbl-api.<your-account>.workers.dev
```

### D1 migration rename note

The Phase 4 deploy agent renamed `apps/api/migrations/0002_word_packs_split.sql` to `0003_word_packs_split.sql` and inserted `0002_add_room_name.sql`. On a **fresh** D1 database the migrations apply cleanly (`0001` → `0002` → `0003`).

If you have an environment that already applied the old `0002_word_packs_split.sql` (Phase 3), wrangler will try to re-apply the new `0003_word_packs_split.sql` and fail because the `word_packs`/`words` tables already exist. Before the first deploy to that environment, reconcile the remote `d1_migrations` table by either:

> **Note on `0004_expand_word_packs.sql`:** this migration re-seeds the bundled `default`, `animals`, `food` packs and adds the `hard` (Extreme) pack. It is idempotent (`INSERT OR REPLACE` / `DELETE` + `INSERT OR IGNORE`) and safe to run on a live database. The next deploy will apply it automatically after the older migrations.

1. Marking `0003_word_packs_split.sql` as already applied in the remote D1:
   ```sql
   INSERT INTO d1_migrations (name) VALUES ('0003_word_packs_split.sql');
   ```
2. Or starting from a fresh D1 database and re-applying all migrations.

Local development can recover by wiping `apps/api/.wrangler` and re-running `npx wrangler d1 migrations apply skribbl --local`.

### CORS / allowed origins

`ALLOWED_ORIGINS` is set to `https://skribbl-io.pages.dev` in `wrangler.toml` for the public launch. For local development you can temporarily set it to `*`. For the web build on Cloudflare Pages, keep it set to the exact Pages origin:

```bash
npx wrangler deploy --var ALLOWED_ORIGINS:"https://skribbl-io.pages.dev"
```

For multiple origins, use a comma-separated list:

```bash
npx wrangler deploy --var ALLOWED_ORIGINS:"https://skribbl-io.pages.dev,https://skribbl.io"
```

The Worker REST layer already validates `Origin` against this list; WebSocket upgrades are not subject to CORS.

### Post-launch data updates

Some deploys only change data, not schema. For example, the bundled word packs were expanded (`0004_expand_word_packs.sql`) to add more words and a new `hard` (Extreme) pack. These migrations are idempotent and safe to run on a live production D1 database:

```bash
cd apps/api
npx wrangler d1 migrations apply skribbl --remote
```

Because the Worker **Deploy command** also runs this step before `wrangler deploy`, a normal Git push to `main` will apply data-only migrations automatically. Custom host-created word packs are never affected by re-seeding.

---

## 3. Deploy the web app to Cloudflare Pages

```bash
cd apps/mobile

# Set the production backend URL
export EXPO_PUBLIC_WS_URL=wss://skribbl-api.<your-account>.workers.dev

# Build the static web export
npx expo export -p web

# Deploy the dist/ folder to Cloudflare Pages
npx wrangler pages deploy dist --project-name skribbl-io
```

After the first deploy, the Pages dashboard will show the URL, e.g.:

```
https://skribbl-io.pages.dev
```

### Manual CLI fallback (not the primary deploy path)

If you ever need to deploy the web app from your local machine instead of the Cloudflare dashboard Git integration, use these settings:

- **Build command:** `cd apps/mobile && npx expo export -p web`
- **Build output directory:** `apps/mobile/dist`
- **Root directory:** `/` (repo root)
- **Environment variable:** `EXPO_PUBLIC_WS_URL=wss://skribbl-api.<your-account>.workers.dev`

The GitHub Actions workflow in `.github/workflows/deploy.yml` is a **manual-only fallback** (`workflow_dispatch`). It does **not** run on push to `main`; production deploys are handled by the Cloudflare dashboard Git integration described above.

---

## 4. Mobile builds via EAS

### One-time setup

1. Create the project on EAS:

   > **Do not skip this step.** `apps/mobile/app.json` currently contains a placeholder EAS projectId (`00000000-0000-0000-0000-000000000000`). Mobile builds will fail until it is replaced with the real project ID.

   ```bash
   cd apps/mobile
   npx eas init
   # This writes the real projectId into app.json.
   ```

   Verify the placeholder was replaced: `grep -A2 '"eas"' app.json | grep -v '00000000-0000-0000-0000-000000000000'`.

2. Configure the production backend URL in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_WS_URL": "wss://skribbl-api.<your-account>.workers.dev"
      }
    }
  }
}
```

### Build commands

```bash
cd apps/mobile

# Internal testing / preview build
npx eas build --profile preview --platform all

# Production build (TestFlight / Play internal testing)
npx eas build --profile production --platform all

# Production build + submit (requires store credentials)
npx eas build --profile production --platform all --submit
```

The included GitHub Actions workflow (`.github/workflows/eas.yml`) can trigger these manually or on `v*.*.*` tags.

---

## 5. CI/CD secrets

Add these to **GitHub Actions secrets** (`Settings → Secrets and variables → Actions`):

| Secret                  | How to obtain                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard bottom-right or `npx wrangler whoami`                                         |
| `EXPO_PUBLIC_WS_URL`    | Your deployed Worker WSS origin, e.g. `wss://skribbl-api.<account>.workers.dev`                    |
| `EXPO_TOKEN`            | Expo dashboard → Settings → Access Tokens                                                          |

**No other secrets are committed.** `wrangler.toml` keeps placeholder IDs with comments; the real IDs are pasted in during provisioning.

---

## 6. CI/CD workflows

Three workflows live in `.github/workflows/`:

- **`ci.yml`** — runs on pushes to `main`/`develop` and PRs: install, build shared, typecheck, lint, unit tests, backend DO tests, frontend tests, protocol E2E, Playwright web E2E, and react-doctor.
- **`deploy.yml`** — **manual fallback only** (`workflow_dispatch`; does NOT run on push). Production deploys go through the Cloudflare dashboard Git integration (§0). Use this only for a one-off CLI-token-based deploy from Actions.
- **`eas.yml`** — manual or `v*.*.*` tag-triggered EAS builds for iOS/Android.

---

## 7. Post-deploy smoke test

1. Open the Pages URL in a browser.
2. Create a room → copy the room code.
3. Open a second browser tab (or mobile build) and join the same room.
4. Verify:
   - WebSocket connects to `wss://skribbl-api.<account>.workers.dev/api/rooms/<ID>/ws`
   - Lobby state syncs for both players.
   - A drawer can choose a word, draw, and the guesser sees strokes.
   - Correct guess advances to reveal and scores update.

---

## 8. Rollback

- **Worker:** `npx wrangler deploy --keep-vars` or redeploy the previous Git ref.
- **Pages:** Cloudflare Pages dashboard → Deployments → Rollback.
- **D1:** migrations are forward-only; for data-level rollback, restore from a D1 backup or run a compensating migration.

---

## 9. Troubleshooting

| Symptom                           | Fix                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `database_id not found` on deploy | Paste the real D1 id from `wrangler d1 create skribbl` into `wrangler.toml`.        |
| `kv_namespace not found`          | Paste the real KV id from `wrangler kv namespace create skribbl-kv`.                |
| Web can’t connect to Worker       | Check `ALLOWED_ORIGINS` matches the Pages origin and the URL uses `wss://`.         |
| Mobile build can’t connect        | Verify `EXPO_PUBLIC_WS_URL` in `eas.json` and the EAS build env.                    |
| D1 tables missing                 | Run `npx wrangler d1 migrations apply skribbl` before or after the Worker deploy.   |
| Web app calls wrong Worker URL    | Check the Cloudflare Pages project env var `EXPO_PUBLIC_WS_URL` and redeploy Pages. |

---

## 10. Architecture notes

- **Durable Object per room:** `idFromName(roomId)` keeps all room state, sockets, and timers in one actor.
- **WebSocket hibernation:** idle rooms drop from memory but retain sockets; cost tracks active rooms.
- **D1:** word packs (seeded defaults + custom host packs) and public lobby registry.
- **KV:** short-lived public lobby cache + per-IP rate limits + room-init settings.
- **No secrets in code:** all runtime config comes from Wrangler bindings/vars or Expo public env.
