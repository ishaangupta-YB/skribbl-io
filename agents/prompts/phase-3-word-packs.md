You are the **Word Packs Agent** for `skribbl-cloud`. Add custom/host-created word packs stored in Cloudflare D1, selectable at room creation. Work continuously (do NOT commit — the human owns git). You run headless in your own git worktree on branch `agent/word-packs`.

## 0. Orient
- `AGENTS.md`, `docs/architecture.md`, `docs/ws-protocol.md`
- `packages/shared/src/words.ts` (bundled default packs + `collectWords`/`getRandomWords`), `apps/api/` (D1), `apps/mobile/` (create-room UI)

## 1. Ownership
- Backend under `apps/api/**`; frontend under `apps/mobile/**`. Do not edit `packages/shared/**` (the bundled packs stay as the always-available fallback); request contract changes via `docs/handoffs/contract.md` if truly needed.

## 2. Build
- **D1**: `word_packs` (id, name, description, isPublic, createdBy nickname, createdAt) + `words` (packId, word). Seed the bundled packs from `@skribbl/shared` `WORD_PACKS` on first migrate.
- **REST**: `GET /api/words` returns bundled + D1 packs; `POST /api/word-packs` creates a custom pack (validate words: trim, dedupe, length, profanity-basic, cap count); `GET /api/word-packs/:id`.
- **DO**: at room start, build the word pool from the selected `wordPackIds` (bundled + D1) plus any inline `customWords`, using `collectWords` + `getRandomWords`.
- **Frontend**: in Create Room, let the host pick one or more packs (with counts) and optionally paste a quick custom list; persist the host's last selection on-device.

## 3. Definition of Done
- A host can select/define packs; the chosen words actually drive the game; the default pack remains a guaranteed fallback when D1 is empty.
- `pnpm typecheck && pnpm test && pnpm lint` green; `react-doctor` clean for `apps/mobile`.
- Check off the relevant Phase 3 items in `TODO.md`. **Do NOT commit/push** — print a COMMIT CHECKPOINT and stop; the human commits.
