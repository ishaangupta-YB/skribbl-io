# Architecture

## High-level

```
┌─────────────────────────────┐         WSS / HTTPS         ┌──────────────────────────────┐
│  Expo app (apps/mobile)      │  ───────────────────────▶  │  Cloudflare Worker (apps/api) │
│  iOS · Android · Web         │                            │  Hono router                  │
│  - Skia canvas               │  REST: rooms, words        │   - REST endpoints            │
│  - Zustand state             │  WS:  /api/rooms/:id/ws     │   - WS upgrade → DO           │
│  - lib/realtime WS client    │                            │                               │
└─────────────────────────────┘                            │  Durable Object: GameRoom     │
                                                            │   - hibernating WebSockets    │
        shared types/protocol/scoring                       │   - authoritative state       │
        ▲ @skribbl/shared ▲                                 │   - Alarms = turn timer       │
        └──────────────── imported by both ─────────────────┤   - DO storage (durable)      │
                                                            └───────┬───────────────────────┘
                                                                    │ D1 (word packs, lobby)
                                                                    │ KV (cache, rate limit)
                                                                    │ R2 (optional replays)
```

## Why Durable Objects

Workers are stateless and short-lived, so real-time room state needs a stable home. A **Durable Object** is a single-threaded, strongly-consistent actor with its own storage and a stable id. Mapping **one DO per room** (`idFromName(roomId)`) gives us:

- A natural home for authoritative room state (no DB round-trip per draw event).
- Built-in broadcast: the DO keeps the set of connected WebSockets.
- **WebSocket Hibernation**: idle rooms evict from memory but keep sockets, so cost ≈ active rooms only.
- **Alarms**: a server-owned timer to drive turn/round transitions — server-authoritative.

## Authoritative game loop (in the DO)

```
lobby ──start──▶ choosing ──(pick word | 15s)──▶ drawing
                                                   │
              (all guessed | round time | drawer left)
                                                   ▼
                                                reveal ──4s──▶ advanceTurn()
                                                                 ├─ next drawer → choosing
                                                                 └─ last drawer, last round → game-over → lobby
```

All transitions are scheduled with **DO Alarms**. Scoring, guess validation, hint reveal, and word masking happen server-side using `@skribbl/shared` so the client can never cheat.

## Data model

- **Live room state** → DO memory + `state.storage` (transactional). Survives hibernation/eviction.
- **Word packs** → bundled in `@skribbl/shared` (default/animals/food); extra/custom packs in **D1**, merged at room start.
- **Public lobby registry** → **D1** rows (+ **KV** cache for the browse list).
- **Optional**: final canvas snapshot / replay → **R2**.

No player accounts (anonymous nicknames). Avatars (emoji + color) live on the device.

## Client architecture (apps/mobile)

- **Expo Router** for navigation; **react-native-web** for the web target.
- **`lib/realtime`**: a typed WebSocket client that validates every frame with the shared zod schemas, auto-reconnects, and exposes events to the store.
- **Zustand** stores: identity (nickname/avatar), connection, and room snapshot (driven by `room:state` + incremental events).
- **`@shopify/react-native-skia`** canvas using **normalized 0–1 coordinates**, so a drawing looks the same on every screen size and platform.
- **NativeWind** design system (light/dark), **Reanimated/Moti** animations, **expo-av/expo-haptics** for feedback.

## Key correctness/security properties

1. **Word never leaks** to guessers — only `maskedWord`/`wordLength`; full `word` is sent solely to the drawer.
2. **Server-authoritative timer** via Alarms.
3. **Bounded scoring** via `@skribbl/shared/scoring`.
4. **No secrets in code** — config via Wrangler bindings + Expo public env.
5. **Resolution-independent drawing** via normalized coordinates.
