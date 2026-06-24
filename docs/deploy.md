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
| Web app      | Cloudflare Pages                     | `expo export -p web` + `wrangler pages deploy dist` | `https://skribbl-cloud.pages.dev`           |
| Mobile app   | EAS (Expo Application Services)      | `eas build --profile production`                    | TestFlight / Play internal testing          |

---

## Prerequisites

- A Cloudflare account with **Workers + D1 + KV + Pages** enabled.
- `wrangler` CLI authenticated: `npx wrangler login` (uses the same token as CI).
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

### CORS / allowed origins

By default `ALLOWED_ORIGINS = "*"` in `wrangler.toml` (development + native clients). For the web build on Cloudflare Pages, set it to the exact Pages origin:

```bash
npx wrangler deploy --var ALLOWED_ORIGINS:"https://skribbl-cloud.pages.dev"
```

For multiple origins, use a comma-separated list:

```bash
npx wrangler deploy --var ALLOWED_ORIGINS:"https://skribbl-cloud.pages.dev,https://skribbl.io"
```

The Worker REST layer already validates `Origin` against this list; WebSocket upgrades are not subject to CORS.

---

## 3. Deploy the web app to Cloudflare Pages

```bash
cd apps/mobile

# Set the production backend URL
export EXPO_PUBLIC_WS_URL=wss://skribbl-api.<your-account>.workers.dev

# Build the static web export
npx expo export -p web

# Deploy the dist/ folder to Cloudflare Pages
npx wrangler pages deploy dist --project-name skribbl-cloud
```

After the first deploy, the Pages dashboard will show the URL, e.g.:

```
https://skribbl-cloud.pages.dev
```

### Build settings (if connecting an external Git repo to Pages)

- **Build command:** `cd apps/mobile && npx expo export -p web`
- **Build output directory:** `apps/mobile/dist`
- **Root directory:** `/` (repo root)
- **Environment variable:** `EXPO_PUBLIC_WS_URL=wss://skribbl-api.<your-account>.workers.dev`

The GitHub Actions workflow in this repo performs the same export + `wrangler pages deploy` automatically on every merge to `main`.

---

## 4. Mobile builds via EAS

### One-time setup

1. Create the project on EAS:

```bash
cd apps/mobile
npx eas init
# This writes the real projectId into app.json.
```

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

- **`ci.yml`** — runs on PRs and `develop` pushes: `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `react-doctor`.
- **`deploy.yml`** — runs on merges to `main`: deploys the Worker (with D1 migrations) and the Pages web export.
- **`eas.yml`** — manual or tag-triggered EAS builds for iOS/Android.

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

| Symptom                           | Fix                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `database_id not found` on deploy | Paste the real D1 id from `wrangler d1 create skribbl` into `wrangler.toml`.      |
| `kv_namespace not found`          | Paste the real KV id from `wrangler kv namespace create skribbl-kv`.              |
| Web can’t connect to Worker       | Check `ALLOWED_ORIGINS` matches the Pages origin and the URL uses `wss://`.       |
| Mobile build can’t connect        | Verify `EXPO_PUBLIC_WS_URL` in `eas.json` and the EAS build env.                  |
| D1 tables missing                 | Run `npx wrangler d1 migrations apply skribbl` before or after the Worker deploy. |

---

## 10. Architecture notes

- **Durable Object per room:** `idFromName(roomId)` keeps all room state, sockets, and timers in one actor.
- **WebSocket hibernation:** idle rooms drop from memory but retain sockets; cost tracks active rooms.
- **D1:** word packs (seeded defaults + custom host packs) and public lobby registry.
- **KV:** short-lived public lobby cache + per-IP rate limits + room-init settings.
- **No secrets in code:** all runtime config comes from Wrangler bindings/vars or Expo public env.
