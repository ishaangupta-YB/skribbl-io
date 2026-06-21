# Handoff: Frontend Integration (Agent B → C & D)

**Status: READY** — the Expo scaffold + design system are in `apps/mobile`. C and D
can now build against the routes, components, and stores below. Build against
`@skribbl/shared` + the mock (`pnpm mock`); never hardcode limits — read `GAME`.

## Stack (Expo SDK 56)

- Expo Router (file-based) + `react-native-web` (web target verified).
- NativeWind v4 (Tailwind v3) — style with `className`; tokens in `global.css` + `tailwind.config.js`.
- Zustand stores in `lib/store`. Skia / reanimated / gesture-handler / async-storage / haptics / expo-audio / svg pre-installed.
- Path alias `@/*` → `apps/mobile/*` (e.g. `import { Button } from "@/components/ui"`).
- Node/CJS config lives in `babel.config.js`, `metro.config.js` (monorepo-aware), `tailwind.config.js`.

> ⚠️ `expo-av` was replaced by **`expo-audio`** (expo-av is gone in SDK 56). Use `expo-audio` for sounds.

## Scaffold

- [x] Expo app created (`apps/mobile`), runs on web (`pnpm --filter @skribbl/mobile dev`); RN-correct for iOS/Android.
- [x] Expo Router routes (below)
- [x] NativeWind configured; theme tokens in **`apps/mobile/global.css`** (CSS vars) + **`apps/mobile/tailwind.config.js`**; runtime hex mirror in **`apps/mobile/theme/colors.ts`**.
- [x] Folders created for other agents: `features/canvas/` (C), `features/game/` (D), `lib/realtime/` (C).

### Routes (`apps/mobile/app`)

| Route | File | Owner | Purpose |
|---|---|---|---|
| `/` | `index.tsx` | B | Home (play/create/join, brand, avatar preview) |
| `/create` | `create.tsx` | B | Create room + settings (rounds/time/players/packs/public/hints) |
| `/join` | `join.tsx` | B | Nickname + room code |
| `/lobby/[id]` | `lobby/[id].tsx` | B | Waiting lobby (players, code copy/share, host Start) |
| `/room/[id]` | `room/[id].tsx` | B → **mounts D** | Game screen shell |
| `/settings` | `settings.tsx` | B | Avatar picker, theme/sound/haptics (modal) |

Navigate with `expo-router`'s `router.push({ pathname: "/lobby/[id]", params: { id, host: "1" } })`.

## Conventions

- **Design tokens / theme**: `apps/mobile/theme` — `useTheme()` → `{ scheme, colors, isDark }` (hex for Skia/SVG/native). `DRAW_PALETTE` + `AVATAR_COLORS` + `AVATAR_EMOJIS` exported there. Class tokens: `bg-background|card|primary|accent|muted`, `text-foreground|muted-foreground|primary`, `border-border`, `success|warning|danger`, radii `rounded-2xl`, etc. Dark mode flips automatically (`.dark` class driven by scheme).
- **UI kit** (`@/components/ui`): `Button`, `IconButton`, `Input`, `Card`, `Sheet` (modal/bottom-sheet), `Avatar`, `Badge`, `Toast` (`ToastProvider` + `useToast()`), `Spinner`, `Text`, `Stepper`, `SwitchRow`, `Chip`, `Screen`.
- **Composites** (`@/components`): `Brand`, `AppHeader`, `AvatarPicker` (also re-exports the UI kit).
- **Toasts**: `const toast = useToast(); toast.success("Nice!")` / `toast.error(...)` / `toast.show({ title, variant })`. `ToastProvider` is already mounted in the root layout.
- **Env var**: `EXPO_PUBLIC_WS_URL` (mock default `ws://localhost:8787`). Helpers in `@/lib/config`: `WS_BASE_URL`, `roomWsUrl(roomId)`, `suggestRoomId()`.

## Stores (`@/lib/store`)

### `useIdentity` (persisted via AsyncStorage)
`{ nickname, avatar:{emoji,color}, settings:{ sound, haptics, theme:"light"|"dark"|"system" }, hasHydrated }`
+ actions `setNickname`, `setAvatar`, `updateSettings`, `randomizeAvatar`. Send `nickname`+`avatar` in the WS `join` frame.

### `useRoomStore` — driven by Agent C's WS client
State: `status` (`idle|connecting|connected|reconnecting|disconnected|error`), `roomId`, `youId`, `room: PublicRoomState | null`, `messages: ChatMessage[]`, `scores: ScoreEntry[]`, `reactions: Reaction[]`, `lastError`.

**C drives it with one call** — feed every validated `ServerMessage`:
```ts
import { useRoomStore } from "@/lib/store";
const { applyServerMessage, setStatus, setRoomId, reset } = useRoomStore.getState();
applyServerMessage(parsedServerMessage); // handles room:state, turn:*, chat, scores, react, game:over, error …
```
- `applyServerMessage` **ignores** high-frequency `draw` / `draw:clear` / `draw:undo` and `pong` on purpose — the canvas should subscribe to those frames directly (perf).
- Selectors (`@/lib/store`): `usePhase`, `useYouId`, `useConnectionStatus`, `usePlayers`, `useHostId`, `useDrawerId`, `useIsHost`, `useIsDrawer`, `useMaskedWord`, `usePhaseEndsAt`, `useRoomSettings`, `useMessages`, `useReactions`, `useLastError`, `useScores`.

### `useRoomDraft`
Holds the `RoomSettings` chosen on the Create screen (`{ settings, setSettings, reset }`). **C/host flow:** when the host creates a room, send these (`POST /api/rooms` or a `settings:update` right after `join`).

## How C plugs in (`lib/realtime` + `features/canvas`)

- **WS client** in `lib/realtime`: connect to `roomWsUrl(roomId)`, send `join` (nickname+avatar) first, validate frames with `parseServerMessage`, auto-reconnect + heartbeat (`GAME.HEARTBEAT_INTERVAL_MS`). Push state via `useRoomStore.getState().applyServerMessage(...)`; set `setStatus(...)`. Expose a hook e.g. `useRoomConnection(roomId)` returning `{ status, send(msg: ClientMessage) }`.
- **Canvas** in `features/canvas`: normalized 0–1 coords, batch points → `draw`. Use `DRAW_PALETTE` from `@/theme`. Subscribe to remote `draw*` frames directly off the socket. Suggested contract:
  ```ts
  type CanvasProps = { editable: boolean; send: (m: ClientMessage) => void; subscribe: (cb: (m: ServerMessage) => void) => () => void };
  ```

## How D plugs in (`features/game`)

- Export `GameScreen` from `@/features/game` (e.g. `index.tsx`). `app/room/[id].tsx` has a commented import showing exactly where to render `<GameScreen roomId={roomId} />` (replace the placeholder).
- Compose Agent C's canvas + chat/guess panel + masked-word header + countdown (from `usePhaseEndsAt()` vs `Date.now()`) + scoreboard (`useScores()`/`usePlayers()`) + reveal/leaderboard. Read everything from `useRoomStore` selectors; style with `@/components/ui`.

## Run

```bash
pnpm install && pnpm build && pnpm mock   # terminal 1
pnpm --filter @skribbl/mobile dev          # terminal 2 (web)
```

Quality gates (all green): `pnpm typecheck`, `pnpm lint`, `pnpm test`, web bundles via `expo export --platform web`.
