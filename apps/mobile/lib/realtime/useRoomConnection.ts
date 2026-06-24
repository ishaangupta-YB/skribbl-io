import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ClientMessage, Stroke } from "@skribbl/shared";
import { RoomConnection } from "./RoomConnection";
import { useRoomStore } from "./store";
import type { ConnectionStatus, Identity } from "./types";

interface ConnState {
  status: ConnectionStatus;
  youId: string | null;
  connection: RoomConnection | null;
}

type ConnAction =
  | { type: "open"; connection: RoomConnection }
  | { type: "status"; status: ConnectionStatus }
  | { type: "youId"; youId: string }
  | { type: "closed" };

const INITIAL_CONN_STATE: ConnState = { status: "idle", youId: null, connection: null };

function connReducer(state: ConnState, action: ConnAction): ConnState {
  switch (action.type) {
    case "open":
      return { status: "idle", youId: null, connection: action.connection };
    case "status":
      return { ...state, status: action.status };
    case "youId":
      return { ...state, youId: action.youId };
    case "closed":
      return INITIAL_CONN_STATE;
    default:
      return state;
  }
}

export interface RoomConnectionHandle {
  status: ConnectionStatus;
  /** Server-assigned id for the local player (null until the first room:state). */
  youId: string | null;
  /** The underlying connection — pass to `<DrawingBoard/>` or subscribe to events. */
  connection: RoomConnection | null;

  // typed send helpers
  send: (message: ClientMessage) => boolean;
  start: () => boolean;
  selectWord: (word: string) => boolean;
  sendDraw: (stroke: Stroke) => boolean;
  clear: () => boolean;
  undo: () => boolean;
  sendChat: (text: string) => boolean;
  react: (emoji: string) => boolean;
  leave: () => boolean;
}

/**
 * React entry point for the realtime layer.
 *
 * Opens a {@link RoomConnection} for `roomId`, sends `join` first, forwards every
 * validated frame into {@link useRoomStore}, and exposes connection status + typed
 * send helpers. The connection is recreated only when the room or identity
 * actually changes (not on every render).
 *
 * D's game screen typically does:
 *   const room = useRoomConnection(roomId, identity);
 *   <DrawingBoard connection={room.connection} />
 */
export function useRoomConnection(roomId: string, identity: Identity): RoomConnectionHandle {
  const [{ status, youId, connection }, dispatch] = useReducer(connReducer, INITIAL_CONN_STATE);
  const connectionRef = useRef<RoomConnection | null>(null);

  // Identity is an object literal in most callers; depend on its primitives so a
  // fresh-but-equal object doesn't tear down and rebuild the socket.
  const { nickname } = identity;
  const { emoji, color } = identity.avatar;

  useEffect(() => {
    const conn = new RoomConnection({ roomId, identity: { nickname, avatar: { emoji, color } } });
    connectionRef.current = conn;
    dispatch({ type: "open", connection: conn });

    const store = useRoomStore.getState();
    store.reset();

    const offStatus = conn.on("status", (next) => {
      dispatch({ type: "status", status: next });
      useRoomStore.getState().setStatus(next);
    });
    const offMessage = conn.on("message", (message) => {
      if (message.type === "room:state") dispatch({ type: "youId", youId: message.youId });
      useRoomStore.getState().applyServerMessage(message);
    });

    conn.connect();

    return () => {
      offStatus();
      offMessage();
      conn.disconnect();
      connectionRef.current = null;
      dispatch({ type: "closed" });
    };
  }, [roomId, nickname, emoji, color]);

  const send = useCallback((message: ClientMessage) => connectionRef.current?.send(message) ?? false, []);
  const start = useCallback(() => connectionRef.current?.start() ?? false, []);
  const selectWord = useCallback((word: string) => connectionRef.current?.selectWord(word) ?? false, []);
  const sendDraw = useCallback((stroke: Stroke) => connectionRef.current?.sendDraw(stroke) ?? false, []);
  const clear = useCallback(() => connectionRef.current?.clear() ?? false, []);
  const undo = useCallback(() => connectionRef.current?.undo() ?? false, []);
  const sendChat = useCallback((text: string) => connectionRef.current?.sendChat(text) ?? false, []);
  const react = useCallback((e: string) => connectionRef.current?.react(e) ?? false, []);
  const leave = useCallback(() => connectionRef.current?.leave() ?? false, []);

  return useMemo(
    () => ({
      status,
      youId,
      connection,
      send,
      start,
      selectWord,
      sendDraw,
      clear,
      undo,
      sendChat,
      react,
      leave,
    }),
    [status, youId, connection, send, start, selectWord, sendDraw, clear, undo, sendChat, react, leave],
  );
}
