# Handoff: Contract (Phase 0 → all agents)

**Status: FROZEN ✅** — `@skribbl/shared` is published in-workspace and ready to build against.

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

## Reference

- Protocol summary: `docs/ws-protocol.md`
- Mock implementing the contract: `tools/mock-ws-server`
