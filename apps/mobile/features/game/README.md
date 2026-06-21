# features/game — Agent D

Game-flow UI: game screen composition (canvas + chat + header), word-choice UI,
masked-word display, chat/guess panel, server-synced countdown (`phaseEndsAt`),
live scoreboard, turn reveal, final leaderboard, and reactions.

Owned by **Agent D**. Agent B only created this folder. The game route
(`app/room/[id].tsx`) mounts a `<GameScreen roomId=... />` exported from here.
Read state from `useRoomStore` (`lib/store`) and use the B design-system
components in `components/ui`. See `docs/handoffs/frontend-integration.md`.
