# features/canvas — realtime Skia drawing board (Agent C)

Cross-platform (iOS / Android / Web) drawing surface plus the tools and wiring
that connect it to the realtime layer (`lib/realtime`). Strokes travel as
**normalized [0,1] coordinates** (the contract's `pointSchema`), so a drawing
looks identical on every screen, independent of device resolution.

## Public API (what Agent D consumes)

```tsx
import { useRoomConnection } from "../../lib/realtime";
import { DrawingBoard } from "../../features/canvas";

function GameScreen({ roomId, identity }) {
  const room = useRoomConnection(roomId, identity);
  return <DrawingBoard connection={room.connection} />;
}
```

- **`<DrawingBoard connection={...} />`** — the drop-in board. Reads strokes from
  the shared store, shows the toolbar only to the active drawer, and streams the
  drawer's input to peers. Props: `connection`, `showToolbar?`,
  `backgroundColor?`, `style?`, `emitIntervalMs?`.
- **`<DrawCanvas />`** — the presentational Skia surface if you need finer
  control (props: `strokes`, `current`, `enabled`, callbacks).
- **`<Toolbar />`** — color / brush / eraser / undo / clear. Plain RN primitives
  so B can restyle with the design system / lucide icons.
- **`useDrawingBoard({ connection })`** — tool state + stroke orchestration hook.
- **`<CanvasKitProvider />`** — wraps the **web** app to load CanvasKit (WASM).

Who can draw is derived from the store: `phase === "drawing" && drawerId === youId`
(see `selectCanDraw`). Guessers get a live read-only mirror.

## How streaming + mirroring works

The active gesture is coalesced and emitted as throttled `draw` frames
(~30fps, `StrokeBatcher`). Consecutive frames overlap by one boundary point, so
receivers stitch them back into one continuous stroke (`appendStrokeSegment` in
`lib/realtime/strokes.ts`). This also makes `draw:undo` remove a whole stroke on
every client. The board resets on `draw:clear` and on each `turn:start`.

## Web / CanvasKit (WASM) setup  — ACTION FOR AGENT B

`@shopify/react-native-skia` needs the CanvasKit WASM runtime in the browser.
Wrap the web app (or at least the game route) once, near the root:

```tsx
import { CanvasKitProvider } from "@/features/canvas";

export default function RootLayout() {
  return (
    <CanvasKitProvider fallback={<SplashScreen />}>
      {/* ...app... */}
    </CanvasKitProvider>
  );
}
```

`CanvasKitProvider` is a **no-op on native** (Metro resolves
`CanvasKitProvider.native.tsx`); only the web build loads WASM.

By default `CanvasKitProvider` loads the WASM from a **version-pinned CDN**
(jsdelivr `canvaskit-wasm@<CANVASKIT_WASM_VERSION>/bin/full/…`), so a static
`expo export -p web` works on any host without bundling `canvaskit.wasm`. The
version constant lives next to the provider and **must** match the installed
`canvaskit-wasm` (check `node_modules/canvaskit-wasm/package.json`).

To self-host the WASM or use a different CDN, override `loadOptions`:

```tsx
<CanvasKitProvider
  loadOptions={{
    locateFile: (file) => `/canvaskit/${file}`, // served from your own origin
  }}
>
```

Also required for web (B owns these config files):

- `react-native-gesture-handler`: import `react-native-gesture-handler` at the
  top of the entry, and wrap the app in `<GestureHandlerRootView style={{flex:1}}>`.
- `react-native-reanimated`: add `react-native-reanimated/plugin` to
  `babel.config.js` (Skia + gesture-handler peer expectation). The canvas itself
  uses `Gesture.Pan().runOnJS(true)` so it does **not** require worklets, but
  the plugin is still recommended by the libraries.
- Ensure Metro serves `.wasm` if you self-host CanvasKit.

## Dependencies this feature imports

`react`, `react-native`, `@shopify/react-native-skia`,
`react-native-gesture-handler`, `zustand`, and `@skribbl/shared`. All are in
`apps/mobile/README.md`'s install list (Agent B installs them).

## Verifying locally

```bash
pnpm build                              # build @skribbl/shared
pnpm mock                               # terminal 1

# pure drawing logic (coords, batching, segment reconstruction):
./node_modules/.bin/tsx --tsconfig apps/mobile/features/canvas/__verify__/tsconfig.verify.json \
  apps/mobile/features/canvas/__verify__/drawing.verify.ts

# realtime client end-to-end vs the mock (drawer + guesser, draw mirroring):
./node_modules/.bin/tsx --tsconfig apps/mobile/lib/realtime/__verify__/tsconfig.verify.json \
  apps/mobile/lib/realtime/__verify__/connection.verify.ts
```

The `__verify__/` folders are **standalone tsx scripts**, not app code. Exclude
them from the app build/typecheck (e.g. `"exclude": ["**/__verify__/**"]` in
`apps/mobile/tsconfig.json`).
