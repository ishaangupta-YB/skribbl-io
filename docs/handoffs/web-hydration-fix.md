# Web hydration fix — handoff note

**Date:** 2026-06-27
**Author:** Orchestrator (cross-boundary edit into Agent B's shell area)

## Problem

The deployed web app (`https://skribbl-io.pages.dev`) was throwing a React hydration error in the console:

```
Uncaught Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message...
```

React #418 is a server/client text-node mismatch during hydration.

## Root cause

`apps/mobile/lib/store/identity.ts` initialized the Zustand store with **random** values for `nickname` and `avatar`:

```ts
nickname: randomGuestName(),  // e.g. "Guest1234" — different every render
avatar: randomAvatar(),       // random emoji + color — different every render
```

During SSR the server rendered one name/avatar, then the browser rehydrated with a different random value, producing a text-node mismatch.

## Fix

`apps/mobile/lib/store/identity.ts` now uses deterministic SSR-safe defaults:

```ts
const DEFAULT_GUEST_NICKNAME = "Guest";
const DEFAULT_GUEST_AVATAR: Avatar = { emoji: "🎨", color: "#6C5CE7" };
```

The random name/avatar is assigned **only after storage rehydration**, and only if the user has not customized those values:

```ts
onRehydrateStorage: () => (state) => {
  if (state) {
    state._setHasHydrated(true);
    if (state.nickname === DEFAULT_GUEST_NICKNAME) {
      state.setNickname(randomGuestName());
    }
    if (state.avatar.emoji === DEFAULT_GUEST_AVATAR.emoji && state.avatar.color === DEFAULT_GUEST_AVATAR.color) {
      state.setAvatar(randomAvatar());
    }
  }
},
```

This keeps the server-rendered HTML identical to the first client render, eliminating the hydration error while still giving first-time users a friendly random identity.

## Verification

- `pnpm build` — pass
- `pnpm typecheck` — pass
- `pnpm --filter @skribbl/shared test` — pass (33 tests)
- `pnpm --filter @skribbl/api test` — pass (49 tests)
- `pnpm --filter @skribbl/mobile test` — pass (71 tests)
- `npx react-doctor@latest . --verbose --diff` — 0 issues

The full `pnpm test` only fails on the live wrangler E2E (`@skribbl/tests/e2e/wrangler-playthrough.e2e.test.ts`) because it requires a running `wrangler dev` backend; this is unrelated to the hydration fix.

## Remaining follow-up

1. **Redeploy the web app.** The currently deployed bundle still contains two issues:
   - The hydration mismatch (fixed in code, needs a new build).
   - A stale `EXPO_PUBLIC_WS_URL` pointing to the wrong Worker (`skribbl-api.82709d122983902a8b513abc7c378662.workers.dev`). Update the Cloudflare Pages project variable to `wss://skribbl-api.ishaangupta12102.workers.dev` and redeploy.
2. **Agent B review:** Because this edit touched `apps/mobile/lib/store/identity.ts` (shell/shared-store area), Agent B should review the change and decide whether to move the store file into a clearly owned location or keep the cross-boundary edit.
