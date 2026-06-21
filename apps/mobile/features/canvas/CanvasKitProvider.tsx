import React, { useEffect, useRef, useState, type ReactNode } from "react";
// Web-only entrypoint: loads the CanvasKit (WASM) backend that Skia needs in the
// browser. Metro resolves `CanvasKitProvider.native.tsx` for iOS/Android, so
// this import is never bundled on native.
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

export interface CanvasKitProviderProps {
  children: ReactNode;
  /** Shown while CanvasKit downloads/initializes. */
  fallback?: ReactNode;
  /**
   * Options forwarded to `LoadSkiaWeb` (e.g. a `locateFile` that points at a
   * CDN-hosted `canvaskit.wasm`). Leave undefined to use Skia's default loader.
   * See `features/canvas/README.md` for the recommended Expo web setup.
   */
  loadOptions?: Parameters<typeof LoadSkiaWeb>[0];
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
  // render never re-triggers the (idempotent but expensive) WASM load.
  const optionsRef = useRef(loadOptions);

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
