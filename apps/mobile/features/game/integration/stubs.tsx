/**
 * Standalone stub implementations of the dependencies Agent D consumes, so the
 * game flow runs and can be exercised before Agent B's design system and Agent
 * C's canvas / WS client are merged.
 *
 * NONE of this is the real thing — when B/C land, the host wires their theme,
 * `<DrawCanvas/>` and `useRoomConnection` into a {@link GameDeps} of the same
 * shape (see `docs/handoffs/frontend-integration.md`). The WS hook here is a
 * faithful reference of the connection contract C will own.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GAME, encode, parseServerMessage, type ClientMessage } from "@skribbl/shared";
import { applyServerMessage, createInitialSnapshot } from "../state/gameStore";
import type { Identity, RoomSnapshot } from "../state/types";
import type { DrawCanvasProps, GameActions, RoomConnection } from "./contracts";

/* ------------------------------------------------------------------ *
 * Canvas stub (Agent C owns the real Skia <DrawCanvas/>)
 * ------------------------------------------------------------------ */
export function StubDrawCanvas({ editable, style }: DrawCanvasProps): React.JSX.Element {
  return (
    <View style={[stubStyles.canvas, style]}>
      <Text style={stubStyles.canvasEmoji}>🎨</Text>
      <Text style={stubStyles.canvasText}>DrawCanvas (Agent C)</Text>
      <Text style={stubStyles.canvasHint}>{editable ? "you can draw" : "view only"}</Text>
    </View>
  );
}

const stubStyles = StyleSheet.create({
  canvas: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E2E5F0",
    borderStyle: "dashed",
  },
  canvasEmoji: { fontSize: 40 },
  canvasText: { marginTop: 8, fontSize: 15, fontWeight: "600", color: "#6B708F" },
  canvasHint: { marginTop: 2, fontSize: 12, color: "#9AA0C9" },
});

/* ------------------------------------------------------------------ *
 * WebSocket connection stub (Agent C owns the real useRoomConnection)
 * ------------------------------------------------------------------ */
const WS_BASE: string =
  (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_WS_URL : undefined) ?? "ws://localhost:8787";

const MAX_BACKOFF_MS = 8000;

/**
 * Reference implementation of the realtime connection: opens a socket, sends
 * `join` first, validates every frame with `parseServerMessage`, folds them
 * into the reducer snapshot, heartbeats, and reconnects with backoff.
 */
export function useStubRoomConnection(roomId: string, identity: Identity): RoomConnection {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => ({
    ...createInitialSnapshot(),
    status: "connecting",
  }));
  const socketRef = useRef<WebSocket | null>(null);
  const closedByUs = useRef(false);
  const attempt = useRef(0);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === 1 /* OPEN */) ws.send(encode(msg));
  }, []);

  useEffect(() => {
    closedByUs.current = false;

    const clearHeartbeat = () => {
      if (heartbeat.current) {
        clearInterval(heartbeat.current);
        heartbeat.current = null;
      }
    };

    const connect = () => {
      setSnapshot((prev) => ({ ...prev, status: attempt.current === 0 ? "connecting" : "reconnecting" }));
      const url = `${WS_BASE}/api/rooms/${encodeURIComponent(roomId)}/ws`;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        attempt.current = 0;
        setSnapshot((prev) => ({ ...prev, status: "open" }));
        ws.send(encode({ type: "join", nickname: identity.nickname, avatar: identity.avatar }));
        clearHeartbeat();
        heartbeat.current = setInterval(() => {
          if (ws.readyState === 1) ws.send(encode({ type: "ping" }));
        }, GAME.HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event: { data: unknown }) => {
        const parsed = parseServerMessage(String(event.data));
        if (!parsed.ok) return;
        setSnapshot((prev) => applyServerMessage(prev, parsed.data));
      };

      ws.onerror = () => {
        /* surfaced via onclose */
      };

      ws.onclose = () => {
        clearHeartbeat();
        if (closedByUs.current) {
          setSnapshot((prev) => ({ ...prev, status: "closed" }));
          return;
        }
        setSnapshot((prev) => ({ ...prev, status: "reconnecting" }));
        const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** attempt.current);
        attempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      clearHeartbeat();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
    };
    // Reconnect only when the room or identity actually changes.
  }, [roomId, identity.nickname, identity.avatar.emoji, identity.avatar.color]);

  const actions: GameActions = {
    start: useCallback(() => send({ type: "start" }), [send]),
    selectWord: useCallback((word: string) => send({ type: "select-word", word }), [send]),
    sendChat: useCallback((text: string) => send({ type: "chat", text }), [send]),
    react: useCallback((emoji: string) => send({ type: "react", emoji }), [send]),
    leave: useCallback(() => {
      closedByUs.current = true;
      send({ type: "leave" });
      socketRef.current?.close();
    }, [send]),
  };

  return { status: snapshot.status, snapshot, actions };
}
