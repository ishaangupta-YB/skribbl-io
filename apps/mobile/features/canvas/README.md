# features/canvas — Agent C

Skia drawing canvas + tools (brush/color/size/eraser/undo/clear), normalized 0–1
coordinates, and rendering of remote `draw` / `draw:clear` / `draw:undo` events.

Owned by **Agent C**. Agent B only created this folder. Mount your canvas inside
the game screen via `features/game` (Agent D) and drive it from `useRoomStore`
(see `lib/store`) + the WS client in `lib/realtime`. See
`docs/handoffs/frontend-integration.md` for the props/contract.
