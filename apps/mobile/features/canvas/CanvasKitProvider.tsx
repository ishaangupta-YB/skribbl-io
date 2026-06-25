import React, { useEffect, useRef, useState, type ReactNode } from "react";
// Web-only entrypoint: loads the CanvasKit (WASM) backend that Skia needs in the
// browser. Metro resolves `CanvasKitProvider.native.tsx` for iOS/Android, so
// this import is never bundled on native.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

type LoadSkiaWebOptions = NonNullable<Parameters<typeof LoadSkiaWeb>[0]>;

/**
 * CanvasKit WASM version. MUST match the installed `canvaskit-wasm` (see
 * `node_modules/canvaskit-wasm/package.json`, pinned by `@shopify/react-native-skia`).
 * A mismatch between the JS loader and the `.wasm` binary will fail to init.
 */
export const CANVASKIT_WASM_VERSION = "0.41.0";

/**
 * Default loader options used when the caller doesn't supply their own. A
 * static `expo export -p web` does NOT emit `canvaskit.wasm`, so without an
 * explicit `locateFile` the browser hangs on the loader. Pointing at a
 * version-pinned CDN build makes the web bundle self-contained on any host.
 */
const DEFAULT_LOAD_OPTIONS: LoadSkiaWebOptions = {
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_WASM_VERSION}/bin/full/${file}`,
};

export interface CanvasKitProviderProps {
  children: ReactNode;
  /** Shown while CanvasKit downloads/initializes. */
  fallback?: ReactNode;
  /**
   * Options forwarded to `LoadSkiaWeb` (e.g. a `locateFile` that points at a
   * CDN-hosted `canvaskit.wasm`). Leave undefined to use the version-pinned CDN
   * default ({@link DEFAULT_LOAD_OPTIONS}). See `features/canvas/README.md`.
   */
  loadOptions?: LoadSkiaWebOptions;
}

/**
 * Wrap the web app (or at least the game route) so the Skia canvas can render in
 * the browser:
 *
 *   <CanvasKitProvider fallback={<Splash/>}>
 *     <App />
 *   </CanvasKitProvider>
 *
 * No-op passthrough on native (see `CanvasKitProvider.native.tsx`).
 */
export function CanvasKitProvider({
  children,
  fallback = null,
  loadOptions,
}: CanvasKitProviderProps): React.ReactElement {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Load once on mount; capture options in a ref so a fresh object literal each
  // render never re-triggers the (idempotent but expensive) WASM load. Fall back
  // to the version-pinned CDN default so static web exports work on any host.
  const optionsRef = useRef(loadOptions ?? DEFAULT_LOAD_OPTIONS);

  useEffect(() => {
    let active = true;
    LoadSkiaWeb(optionsRef.current)
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (active) setError(err);
        console.error("[canvas] failed to load CanvasKit (WASM)", err);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error || !ready) return <>{fallback}</>;
  return <>{children}</>;
}
