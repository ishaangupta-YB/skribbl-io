import React, { type ReactNode } from "react";

export interface CanvasKitProviderProps {
  children: ReactNode;
  fallback?: ReactNode;
  loadOptions?: unknown;
}

/**
 * Native no-op: Skia ships its own native backend, so there is no WASM to load.
 * The web build uses `CanvasKitProvider.tsx` instead (resolved by Metro).
 */
export function CanvasKitProvider({ children }: CanvasKitProviderProps): React.ReactElement {
  return <>{children}</>;
}
