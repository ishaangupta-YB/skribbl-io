# apps/mobile — Expo app (Agents B, C, D)

One Expo (React Native) codebase for **iOS, Android, and Web**. Owned jointly: **B** (shell + design system), **C** (canvas + realtime), **D** (game flow). See the ownership matrix in `AGENTS.md`.

## Scaffold (Agent B, first)

```bash
# from skribbl-cloud/apps/mobile
pnpm create expo-app@latest . --template default   # TypeScript + Expo Router
# core deps
pnpm add @skribbl/shared zustand
pnpm add @shopify/react-native-skia react-native-gesture-handler react-native-reanimated
pnpm add nativewind tailwindcss lucide-react-native
pnpm add @react-native-async-storage/async-storage expo-haptics expo-av
```

Name the package `@skribbl/mobile`. Ensure scripts include:

```jsonc
{
  "scripts": {
    "dev": "expo start --web",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

## Structure (B creates these so C and D have a home)

```
apps/mobile/
├─ app/                 # expo-router routes (B)
│  ├─ index.tsx         # Home
│  ├─ create.tsx        # Create room
│  ├─ join.tsx          # Join room
│  ├─ lobby/[id].tsx    # Waiting lobby
│  └─ room/[id].tsx     # Game screen (mounts D)
├─ components/ui/       # design system (B)
├─ features/
│  ├─ canvas/           # Skia canvas + tools (C)
│  └─ game/             # game flow widgets (D)
├─ lib/
│  ├─ realtime/         # typed WS client (C)
│  └─ store/            # zustand stores (B)
└─ theme/               # NativeWind tokens (B)
```

## Connecting to the backend

- Use `EXPO_PUBLIC_WS_URL` (default `ws://localhost:8787`). Build the URL as
  `${EXPO_PUBLIC_WS_URL}/api/rooms/${roomId}/ws` and send `join` first.
- During Phase 1, run the mock: `pnpm mock` (from repo root). Switch to `wrangler dev` in Phase 2.
- Validate every incoming frame with `parseServerMessage` from `@skribbl/shared`.

## Guidelines

- Pull all durations/limits from `@skribbl/shared` `GAME`; render countdowns from `phaseEndsAt`.
- Drawing uses **normalized 0–1 coordinates**; batch points before sending `draw`.
- Beautiful, modern UI with light/dark themes, animations (Reanimated/Moti), sounds + haptics.
- Run `react-doctor` after changes: `npx -y react-doctor@latest . --verbose --diff`.

## Web canvas note (Agent C)

`@shopify/react-native-skia` on web needs CanvasKit (WASM). Configure it early per the Skia web docs so the canvas renders in the browser build.
