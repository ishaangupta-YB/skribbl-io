# skribbl-cloud

A cross-platform (iOS + Android + Web) skribbl-style multiplayer drawing & guessing game, rebuilt from the original Flutter/Node/MongoDB app onto a **single Expo (React Native) codebase** and a **100% Cloudflare backend** (Workers + Durable Objects + D1 + KV).

> This folder is a self-contained rewrite. The original Flutter app (`../lib`, `../server`) is left untouched as reference.

## Why this stack

| Concern                  | Choice                                                                         | Reason                                                                              |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Client (iOS/Android/Web) | **Expo + Expo Router**                                                         | One TypeScript codebase, three platforms                                            |
| Drawing canvas           | **@shopify/react-native-skia**                                                 | GPU canvas that runs on native + web (CanvasKit)                                    |
| Real-time backend        | **Cloudflare Durable Objects** (WebSocket Hibernation + Alarms)                | Socket.io can't run on Workers; one DO per room is the native, scalable replacement |
| Persistence              | **D1** (word packs, lobby registry) + **KV** (cache) + DO storage (live state) | Fully Cloudflare-native DB layer                                                    |
| Contract                 | **`packages/shared`** (Zod)                                                    | Single source of truth shared by client + server                                    |

## Monorepo layout

```
skribbl-cloud/
├─ packages/shared/      # FROZEN CONTRACT: zod schemas, protocol, scoring, words
├─ apps/mobile/          # Expo app (iOS/Android/Web)        [Agents B/C/D]
├─ apps/api/             # Cloudflare Worker + Durable Object [Agent A]
├─ tools/mock-ws-server/ # Local protocol mock for UI dev
├─ docs/                 # architecture, ws-protocol, handoffs
├─ PLAN.md  AGENTS.md  TODO.md
```

## Quick start

```bash
# from skribbl-cloud/
pnpm install
pnpm build                 # builds @skribbl/shared (everything depends on it)
pnpm test                  # runs the shared contract test suite

# develop the UI against the local protocol mock:
pnpm mock                  # ws://localhost:8787/api/rooms/<ROOM_ID>/ws
```

`apps/mobile` and `apps/api` are scaffolded by their owning agents in Phase 1 — see `AGENTS.md` and each app's README.

## Status

Phases 0–4 are complete and verified: the backend is deployed to Cloudflare Workers + Durable Objects + D1 + KV, the web app is deployed to Cloudflare Pages, and the mobile app is configured for EAS builds. See `TODO.md` for the verification checklist and `docs/deploy.md` for the production runbook.
