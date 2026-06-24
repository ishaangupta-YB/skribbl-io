## COMMIT CHECKPOINT — Deploy Agent ready for human review

I have prepared the Phase 4 deploy infrastructure for `skribbl-cloud`. **No commits or pushes were made.**

### What changed

| Area | Files |
|---|---|
| **Backend production config** | `apps/api/wrangler.toml` (production-ready D1/KV/DO bindings, placeholder IDs with instructions, `ALLOWED_ORIGINS` var), `apps/api/src/env.ts`, `apps/api/src/index.ts` (dynamic CORS) |
| **D1 migrations** | Renamed conflicting `0002_word_packs_split.sql` → `0003_word_packs_split.sql`; updated header to clarify dependency on `0001`/`0002` |
| **Web export / Pages** | `apps/mobile/package.json` (`export:web`, `deploy:web`, `wrangler` devDep), `apps/mobile/app.json` (EAS project id placeholder) |
| **Mobile EAS** | New `apps/mobile/eas.json` (development/preview/production profiles) |
| **CI/CD** | New `.github/workflows/deploy.yml` (Worker + D1 + Pages on `main`), `.github/workflows/ci.yml` (PR/CI checks), `.github/workflows/eas.yml` (manual/tag mobile builds) |
| **Docs / TODO** | New `docs/deploy.md` (full runbook), `TODO.md` Phase 4 deploy items checked off |

### Verification output

- `pnpm install` — passed
- `pnpm build` — passed
- `pnpm typecheck` — passed (5/5 workspace packages)
- `pnpm test` — passed (89 tests: 26 API + 30 mobile + 33 shared)
- `pnpm lint` — passed
- `expo export -p web` — passed, outputs `apps/mobile/dist`
- `react-doctor` diff scan — **no new issues** (only changed config files)
- `react-doctor` full scan — 48/100, 81 warnings (pre-existing Phase 3 baseline; unchanged by these deploy-only changes)

### Manual steps for the human before first deploy

1. In `apps/api/wrangler.toml`, replace the placeholder `database_id` and KV `id` with real values from:
   ```bash
   cd apps/api
   npx wrangler d1 create skribbl
   npx wrangler kv namespace create skribbl-kv
   ```
2. In `apps/mobile/eas.json` and `app.json`, replace `YOUR_ACCOUNT` / `00000000-...` placeholders with the deployed Worker account and EAS project id from `npx eas init`.
3. Add GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `EXPO_PUBLIC_WS_URL`, `EXPO_TOKEN`.
4. Run `npx wrangler d1 migrations apply skribbl` and `npx wrangler deploy` from `apps/api`.

### Suggested commit message

```
phase4(deploy): production deploy runbook + CI/CD + wrangler/EAS config

- Finalize wrangler.toml for Cloudflare Worker/D1/KV/DO with placeholder IDs
- Add ALLOWED_ORIGINS CORS var and dynamic origin handling
- Fix duplicate 0002 migration by renaming word_packs_split to 0003
- Add Expo web export + Pages deploy scripts to mobile
- Add eas.json for iOS/Android EAS builds
- Add GitHub Actions: deploy.yml (worker + web), ci.yml, eas.yml
- Write docs/deploy.md runbook and check off Phase 4 deploy items
```

**Next step:** review the diff, then commit in this worktree and merge `agent/deploy` into `develop`.
