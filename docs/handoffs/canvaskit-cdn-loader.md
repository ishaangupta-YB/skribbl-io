# Handoff: CanvasKit default CDN loader (QA → Agent C)

**Status: DONE ✅** — `CanvasKitProvider` now loads the Skia WASM runtime from a
version-pinned CDN by default, so static `expo export -p web` builds render the
canvas on any host (this unblocked the Playwright web E2E in CI).

> **Cross-lane note:** this edit touches `apps/mobile/features/canvas/**`, which
> is **Agent C's** ownership area. It was made as a QA-unblocking fix during the
> Phase 4 Playwright/CI integration. Flagging it here so C is aware and can fold
> it into the canvas feature going forward.

## Why

`expo export -p web` does **not** emit `canvaskit.wasm`. The whole `/room/[id]`
screen is wrapped in `<CanvasKitProvider>`, so without a `locateFile` the web
build hung forever on the "Loading canvas…" fallback (`LoadSkiaWeb` never
resolved). The Playwright E2E timed out at this point.

## Change (`apps/mobile/features/canvas/CanvasKitProvider.tsx`)

- Added an exported constant `CANVASKIT_WASM_VERSION = "0.41.0"` — **must match**
  the installed `canvaskit-wasm` (pinned by `@shopify/react-native-skia@2.6.2`;
  verify via `node_modules/canvaskit-wasm/package.json`).
- Added a default `loadOptions` with:
  ```ts
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_WASM_VERSION}/bin/full/${file}`
  ```
- The provider now uses `loadOptions ?? DEFAULT_LOAD_OPTIONS`, so existing callers
  that pass their own `loadOptions` are unaffected; native stays a no-op.

## Implications / follow-ups for C

- **Runtime dependency on jsdelivr.** The web canvas fetches `canvaskit.wasm`
  from the CDN at runtime. For offline/air-gapped or stricter CSP setups, override
  `loadOptions` with a self-hosted `locateFile` (e.g. `/canvaskit/${file}`) and
  copy the `.wasm` into the export. See `features/canvas/README.md`.
- **Keep the version in sync.** When bumping `@shopify/react-native-skia`, update
  `CANVASKIT_WASM_VERSION` to the new `canvaskit-wasm` version or the loader and
  binary will mismatch.

## Verification

- `pnpm typecheck` / `pnpm lint` — clean.
- Playwright web E2E (`tests/e2e/run-playwright-ci.sh`) — passes; canvas renders
  from the CDN and the 2-client game reaches the leaderboard.
