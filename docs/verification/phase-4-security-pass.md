# Phase 4 — Security Pass

**Agent:** QA (`agent/qa`)
**Date:** 2026-06-23
**Verdict:** PASS — no secrets in client bundles; word hidden from guessers; timer/scoring server-authoritative; input validation everywhere.

---

## 1. No secrets in client bundles

### Findings

- **`apps/mobile/lib/config.ts`** — the only `process.env` reference in the client. It reads `EXPO_PUBLIC_WS_URL` (a **public** WebSocket URL, not a credential) with a `ws://localhost:8787` fallback. `EXPO_PUBLIC_*` vars are designed by Expo to be public and are safe to inline.
- **`apps/mobile/lib/realtime/url.ts`** — reads the same `EXPO_PUBLIC_WS_URL` defensively (guards against `process` being undefined on native).
- **`apps/api/wrangler.toml`** — uses **placeholder IDs** (`00000000-0000-0000-0000-000000000000` for D1, `0000000000000000000000000000kvid` for KV). No real Cloudflare account IDs, API tokens, or secrets are committed. The real IDs are injected at deploy time by the human via `wrangler` CLI.
- **No API keys, passwords, tokens, or private keys** found anywhere in `apps/mobile/` or `packages/shared/`.
- The app is **anonymous** (no auth, no cookies, no credentials) — there are no user secrets to leak by design.

### Verification

```bash
grep -rn "secret\|password\|api_key\|apiKey\|token" apps/mobile/lib apps/mobile/app --include="*.ts" --include="*.tsx" -i
# → only a theme color comment (no actual secrets)
```

**Verdict: PASS** — the client bundle contains no secrets.

---

## 2. Word hidden from guessers (anti-cheat)

### Mechanism

The `GameRoom` DO builds per-recipient messages:
- `turn:choosing` — `choices` is `null` for non-drawers; only the drawer gets the word list.
- `turn:start` — `word` is `null` for non-drawers; only the drawer gets the real word. Guessers get `maskedWord` + `wordLength`.
- `room:state` — `word` and `wordChoices` are `null` for non-drawers (see `buildState()` in `GameRoom.ts`).
- `turn:reveal` — the word is revealed to everyone, but this is the **legitimate** end-of-turn reveal (not a leak).
- `game:over` — carries only a `leaderboard` (no `word` field).

The drawer's own chat containing the exact word is **suppressed** server-side (never broadcast).

### Verification

- `apps/api/test/security.test.ts` — "a guesser never sees the word, choices, or a leaky room:state across a full turn" (PASS)
- `apps/api/test/security.test.ts` — "a guesser's room:state never carries the drawer-only fields" (PASS)
- `apps/api/test/security.test.ts` — "game:over carries a leaderboard but no `word` field" (PASS)
- `apps/api/test/security.test.ts` — "the drawer's chat containing the exact word is suppressed" (PASS)
- `apps/api/test/game.test.ts` — full playthrough anti-cheat assertions (PASS)
- `tests/e2e/wrangler-playthrough.e2e.test.ts` — live 3-client playthrough, `antiCheatViolation` flag stays false (PASS)
- `apps/mobile/features/game/state/gameStore.test.ts` — "ANTI-CHEAT: never exposes the word to a guesser even if the frame carries it" (PASS)

**Verdict: PASS** — the word is never leaked to guessers outside the legitimate `turn:reveal`.

---

## 3. Server-authoritative timer & scoring

### Timer

- All phase transitions (choosing → drawing → reveal → next/over) are driven by **DO Alarms** (`ctx.storage.setAlarm()`), never `setTimeout`/`setInterval`.
- A client cannot advance the state machine by sending out-of-phase frames — `handleSelectWord` checks `r.phase !== "choosing"`, `handleChat` checks `r.phase === "drawing"`, etc.
- The `phaseEndsAt` timestamp sent to clients is for **display only** (countdown); the server alarm is the authoritative transition.

### Scoring

- `scores:update` and `guess:correct` are **server-only** message types — a client sending them is rejected with `INVALID_MESSAGE` (verified in `security.test.ts`).
- Points are computed server-side via `calculateGuesserScore` / `calculateDrawerScore` from `@skribbl/shared`. The client never computes or submits scores.
- `player.score` is only mutated server-side; the client's reducer only reads scores from server messages.

### Verification

- `apps/api/test/security.test.ts` — "ignores out-of-phase client frames (no phase advance without an alarm)" (PASS)
- `apps/api/test/security.test.ts` — "rejects a client impersonating scores:update / guess:correct / room:state" (PASS)
- `apps/api/test/game.test.ts` — alarm-driven auto-pick and phase-end transitions (PASS)
- `apps/api/test/edge-cases.test.ts` — simultaneous correct guesses scored with correct order bonus (PASS)

**Verdict: PASS** — timer and scoring are fully server-authoritative.

---

## 4. Input validation everywhere

### WebSocket frames

Every inbound frame is parsed through `parseClientMessage` (Zod `clientMessageSchema`), which validates:
- `nickname` — 1–16 chars (trimmed)
- `avatar` — emoji (1–12 chars) + hex color (`#RRGGBB`)
- `chat.text` — 1–120 chars (trimmed)
- `stroke.points` — 1–600 points, each `{x, y}` numbers
- `stroke.color` — hex color regex
- `stroke.width` — 1–48
- `stroke.mode` — `"draw" | "erase"`
- `react.emoji` — 1–12 chars
- Invalid/unknown types → `INVALID_MESSAGE` error

### REST endpoints

- `POST /api/rooms` — `roomSettingsSchema.partial()` validation; rejects out-of-range settings (400)
- `POST /api/word-packs` — name (1–50), description (≤200), words (1–100, each ≤30 chars, profanity filter)
- `GET /api/rooms/:id/ws` — `roomIdSchema` validation (4–12 chars)
- Rate limiting: 15 room creates/min/IP, 10 word-pack creates/min/IP (KV-backed, fails open)

### Verification

- `apps/api/test/edge-cases.test.ts` — oversized strokes, invalid colors/widths/modes, empty/oversized chat, non-JSON, wrong-shape, invalid join (all PASS)
- `apps/api/test/security.test.ts` — invalid room id (400), oversized settings (400), oversized word pack (400) (all PASS)
- `apps/api/test/rest.test.ts` — invalid settings rejection, profanity rejection (PASS)
- `apps/api/test/edge-cases.test.ts` — rate limiting throttles after 15 creates (PASS)

**Verdict: PASS** — all inputs are validated.

---

## 5. Authorization

- Only the **host** can `start`, `kick`, `settings:update` — enforced by `fromId !== r.hostId` checks.
- Only the **drawer** can `draw`, `draw:clear`, `draw:undo` — enforced by `fromId === this.currentDrawerId()`.
- A host cannot kick themselves.
- `settings:update` is only allowed in the `lobby` phase.

### Verification

- `apps/api/test/security.test.ts` — non-host start rejected, non-host kick ignored, host self-kick ignored, non-host settings ignored, non-drawer draw ignored (all PASS)
- `apps/api/test/game.test.ts` — "ignores draw events from non-drawers" (PASS)

**Verdict: PASS** — authorization is enforced on every privileged action.

---

## Summary

| Check | Verdict |
|---|---|
| No secrets in client bundles | PASS |
| Word hidden from guessers | PASS |
| Server-authoritative timer | PASS |
| Server-authoritative scoring | PASS |
| Input validation (WS + REST) | PASS |
| Authorization (host/drawer-only) | PASS |
| Rate limiting | PASS |

**Overall: PASS** — the security posture meets the Phase 4 Definition of Done.
