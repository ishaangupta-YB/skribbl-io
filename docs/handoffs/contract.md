# Handoff: Contract (Phase 0 → all agents)

**Status: FROZEN ✅ — tagged `v1` (Phase 2 integration complete).** `@skribbl/shared` is published in-workspace and ready to build against. The contract was verified end-to-end against the real Cloudflare Worker + Durable Object and the Expo client in Phase 2; no drift was found and no changes were required.

## What you get

- **Schemas** (`schemas.ts`): `GamePhase`, `Avatar`, `Player`, `RoomSettings` (+ `defaultRoomSettings`), `Point`, `Stroke`, `ChatMessage`, `ScoreEntry`, `PublicRoomState`.
- **Protocol** (`protocol.ts`): `clientMessageSchema` / `serverMessageSchema` (discriminated unions), `ClientMessage` / `ServerMessage` types, `parseClientMessage`, `parseServerMessage`, `encode`, `ErrorCode`.
- **Scoring** (`scoring.ts`): `calculateGuesserScore`, `calculateDrawerScore`, `isExactGuess`, `isCloseGuess`, `levenshtein`, `normalizeGuess`.
- **Masking/hints** (`mask.ts`): `maskWord`, `revealLetters`, `maxHintLetters`.
- **State machine** (`state-machine.ts`): `advanceTurn`, `phaseDurationSec`, `isTimedPhase`.
- **Words** (`words.ts`): `WORD_PACKS`, `collectWords`, `getRandomWords`, `getWordPack`, `listWordPacks`.
- **Constants/utils**: `GAME`, `ROOM_ID_ALPHABET`, `generateRoomId`, `shuffle`, `clamp`.

## How to use

```ts
import {
  GAME,
  parseClientMessage,
  encode,
  type ServerMessage,
  type PublicRoomState,
} from "@skribbl/shared";
```

Build it first: `pnpm build` (or `pnpm --filter @skribbl/shared build`). Tests: `pnpm --filter @skribbl/shared test`.

## Rules

- Do **not** copy/redefine these types locally. Import them.
- Need a change? Follow "Changing the contract" in `AGENTS.md` — Orchestrator only, then the mock + this doc are updated together.

## Contract changes

### 2026-06-27 — Expanded bundled word packs

- `packages/shared/src/words.ts`: `WORD_PACKS` expanded with more words in `default`, `animals`, and `food` packs, plus a new `hard` ("Extreme") pack for very tough-to-draw concepts.
- `apps/api/migrations/0001_init.sql` and `apps/api/migrations/0004_expand_word_packs.sql` updated to keep the production D1 in sync.
- No protocol or schema changes; existing clients and the mock server pick up the new words automatically via `@skribbl/shared`.

### 2026-06-27 — MAX_PLAYERS increased from 8 to 20

- `packages/shared/src/constants.ts`: `GAME.MAX_PLAYERS` changed from `8` to `20`.
- `apps/api/src/db/schema.ts`: D1 `lobby_rooms.max_players` default changed from `8` to `20`.
- `apps/api/migrations/0001_init.sql`: D1 init default changed from `8` to `20`.
- `apps/mobile/lib/realtime/RoomConnection.test.ts`: test fixture updated from `8` to `20`.
- `apps/api/test/security.test.ts`: rejection test comment updated (still uses `99` which is above `20`).
- No protocol or schema shape changes; the Zod schema in `packages/shared/src/schemas.ts` derives `max()` from `GAME.MAX_PLAYERS` so validation is automatically in sync.

## Reference

- Protocol summary: `docs/ws-protocol.md`
- Mock implementing the contract: `tools/mock-ws-server`
