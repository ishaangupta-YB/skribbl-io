# PLAN — skribbl-cloud

Port the original Flutter + Node/Socket.io/MongoDB skribbl clone to one Expo (React Native) codebase on iOS/Android/Web with a 100% Cloudflare backend, built by parallel Devin/Claude agents.

## Locked decisions

- **Layout:** new top-level folder `skribbl-cloud/`; original Flutter untouched.
- **Backend:** Cloudflare **Durable Objects** (WebSocket Hibernation + Alarms), Workers Paid plan.
- **Accounts:** anonymous nicknames only (guest avatar = emoji + color, stored on-device).
- **Scope:** faithful port **+ enhancements** (modern UI, avatars, public/private lobbies, custom word packs, reactions, hints, sounds, animations).
- **Git & process:** the git repo IS `skribbl-cloud/` (the parent Flutter dir is read-only reference). **The human owns all git** — agents never commit/push; they print **COMMIT CHECKPOINTs** and stop. A strict **Verifier** agent gates every phase.

## Architecture (old → new)

| Original | Replacement |
|---|---|
| Express HTTP | Hono on Workers |
| Socket.io server | One Durable Object per room (WS Hibernation) |
| `io.to(room)` | DO holds room sockets, broadcasts |
| Mongo `Room`/`Player` | DO in-memory state + DO storage |
| `getWord()` adjectives | Drawable word packs (bundled) + D1 custom packs |
| Client `setInterval` timer | **DO Alarms** (server-authoritative) |
| Full word sent to all (cheat bug) | Masked word to guessers, full word only to drawer |

## Cloudflare services

- **Workers + Hono** — REST + WebSocket upgrade routing.
- **Durable Objects** — `GameRoom`: authoritative state, alarms timer, hibernating sockets.
- **D1 (+ Drizzle)** — word packs, public lobby registry, optional match archive.
- **KV** — cached lobby list, config, rate limits.
- **R2** *(optional)* — final canvas snapshots / replays.

## Phases

- **Phase 0 — Foundation & Contract** ✅ *(this commit)*: monorepo tooling, `@skribbl/shared` (frozen Zod contract: schemas, protocol, scoring, mask, state machine, words) + tests, and `tools/mock-ws-server`.
- **Phase 1 — Parallel build** (4 agents, decoupled by the contract; you commit + merge B's scaffold first so C/D can wire in):
  - **A · Backend/DO** → `apps/api`
  - **B · App shell + design system** → `apps/mobile` (router, theme, screens, avatar picker)
  - **C · Realtime canvas** → Skia canvas + tools + typed WS client (`lib/realtime`)
  - **D · Game flow** → game screen, chat/guess, timer, scoreboard, leaderboard
- **Phase 2 — Integration**: wire client to real Worker/DO via `wrangler dev`; multi-client E2E; lock contract v1.
- **Phase 3 — Enhancements**: public lobby browser (D1/KV), custom word packs, reactions, hints, sounds/haptics, theming, animations, confetti.
- **Phase 4 — Hardening & deploy**: Vitest + RN tests + Playwright; reconnection/edge cases; rate limiting; deploy Worker + D1 + web (Pages) + mobile (EAS); run `react-doctor`.
- **Verification gate (after every phase)**: a strict, read-only **Verifier** agent (`agents/verify.sh <n>`) re-runs the full suite + a multi-client playthrough, checks the phase Definition of Done + anti-cheat invariants, and writes `docs/verification/phase-<n>.md` (PASS/FAIL). No phase advances on a FAIL.

## Definition of done

- iOS + Android + Web from one codebase; real-time create/join/draw/guess/score/leaderboard across ≥3 clients.
- Backend 100% Cloudflare, deployed; web on Pages; mobile buildable via EAS.
- Word never leaks to guessers; timer/scoring server-authoritative; no secrets in client.
- Enhancements shipped; `react-doctor` clean; CI green.

See `docs/architecture.md` and `docs/ws-protocol.md` for detail, `AGENTS.md` for the multi-agent workflow, and `TODO.md` for live status.
