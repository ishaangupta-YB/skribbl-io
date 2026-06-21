# Handoff: Frontend Integration (Agent B → C & D)

**Status: NOT STARTED** — Agent B fills this in once the Expo scaffold + design system land.

Template to complete:

## Scaffold

- [ ] Expo app created (`apps/mobile`), runs on web/iOS/Android
- [ ] Expo Router structure (list the routes)
- [ ] NativeWind configured; theme tokens exported from `____`
- [ ] Folders created for other agents: `features/canvas/` (C), `features/game/` (D), `lib/realtime/` (C)

## Conventions

- Design tokens / theme location: `____`
- UI components available (Button, Input, Card, Modal, Avatar, …): `____`
- Zustand store(s) + selectors: `____`
- Env var for backend: `EXPO_PUBLIC_WS_URL` (mock default `ws://localhost:8787`)

## How C plugs in

- WS client lives in `lib/realtime`; expose a hook (e.g. `useRoomConnection(roomId)`).
- Canvas component contract (props/events): `____`

## How D plugs in

- Game screen mounts canvas (C) + chat/score panels; reads room store.
- Where to add the game route: `____`

## Run

```bash
pnpm install && pnpm build && pnpm mock   # terminal 1
pnpm --filter @skribbl/mobile dev          # terminal 2 (web)
```
