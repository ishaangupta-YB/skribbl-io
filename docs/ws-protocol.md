# WebSocket Protocol

The canonical, machine-checked definition lives in
[`packages/shared/src/protocol.ts`](../packages/shared/src/protocol.ts) and
[`schemas.ts`](../packages/shared/src/schemas.ts). This page is the human summary.
**If this doc and the code disagree, the code wins.**

## Connection

```
wss://<worker-host>/api/rooms/:roomId/ws      (prod)
ws://localhost:8787/api/rooms/:roomId/ws      (mock)
```

The `roomId` is in the URL and maps to one Durable Object. The **first** frame a
client sends MUST be a `join`. All frames are JSON; parse with
`parseClientMessage` / `parseServerMessage`, build with `encode`.

## Client → Server

| `type` | payload | notes |
|---|---|---|
| `join` | `nickname`, `avatar {emoji,color}` | required first message |
| `start` | – | host only; from lobby |
| `select-word` | `word` | drawer only; during `choosing` |
| `draw` | `stroke {points[],color,width,mode}` | drawer only; points are normalized 0–1, batched |
| `draw:clear` | – | drawer only |
| `draw:undo` | – | drawer only |
| `chat` | `text` | server decides if it's the correct guess |
| `react` | `emoji` | |
| `settings:update` | `settings` (partial) | host only; lobby |
| `kick` | `playerId` | host only |
| `leave` | – | |
| `ping` | – | → `pong` |

## Server → Client

| `type` | payload | notes |
|---|---|---|
| `room:state` | `state` (PublicRoomState), `youId` | full sanitized snapshot |
| `player:joined` / `player:left` | `player` / `playerId` | |
| `host:changed` | `hostId` | |
| `turn:choosing` | `drawerId,round,durationSec,phaseEndsAt,choices` | `choices` only to the drawer |
| `turn:start` | `drawerId,round,maskedWord,wordLength,durationSec,phaseEndsAt,word` | `word` only to the drawer |
| `turn:hint` | `maskedWord` | progressively reveals letters (guessers only) |
| `turn:reveal` | `word,scores[]` | end of a turn |
| `draw` / `draw:clear` / `draw:undo` | stroke / – | mirrors drawer to others |
| `chat` | `message {id,playerId,nickname,text,kind,ts}` | `kind`: chat·system·correct·close |
| `guess:correct` | `playerId,nickname,points` | |
| `scores:update` | `scores[]` | |
| `react` | `playerId,emoji` | |
| `game:over` | `leaderboard[]` | |
| `error` | `code,message` | `code` ∈ ErrorCode enum |
| `pong` | – | |

## Anti-cheat rules (enforced server-side)

- The full `word` is included ONLY in `turn:start`/`room:state` frames addressed to the **drawer**. Guessers receive `maskedWord` + `wordLength`.
- The countdown is authoritative: clients render from `phaseEndsAt`, they do not decide when a turn ends.
- Scoring uses `@skribbl/shared/scoring`; the server computes points, clients only display them.

## Timing & sync

- Every timed phase carries `phaseEndsAt` (epoch ms). Clients compute remaining time as `phaseEndsAt - Date.now()` and re-sync on each `room:state`.
- Constants (durations, limits) come from `@skribbl/shared` `GAME` — never hardcode them in the UI.
