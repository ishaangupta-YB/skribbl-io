# PLAN — skribbl-cloud

Build a cross-platform Expo (React Native) skribbl-style game on iOS/Android/Web with a 100% Cloudflare backend, built by parallel Devin/Claude agents.

## Locked decisions

- **Layout:** the app lives in `skribbl-cloud/`.
- **Backend:** Cloudflare **Durable Objects** (WebSocket Hibernation + Alarms), Workers Paid plan.
- **Accounts:** anonymous nicknames only (guest avatar = emoji + color, stored on-device).
- **Scope:** full feature set (modern UI, avatars, public/private lobbies, custom word packs, reactions, hints, sounds, animations).
- **Git & process:** the git repo IS `skribbl-cloud/`. **The human owns all git** — agents never commit/push; they print **COMMIT CHECKPOINTs** and stop. A strict **Verifier** agent gates every phase.

## Backend design

| Component | Role |
|---|---|
| Hono on Workers | REST + WebSocket upgrade routing |
| One Durable Object per room (WS Hibernation) | Authoritative room state; holds room sockets and broadcasts |
| DO in-memory state + DO storage | Live room state, durable across hibernation |
| Drawable word packs (bundled) + D1 custom packs | Words served per room |
| **DO Alarms** | Server-authoritative turn/round timer |
| Masked word to guessers, full word only to drawer | Anti-cheat word masking |

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
