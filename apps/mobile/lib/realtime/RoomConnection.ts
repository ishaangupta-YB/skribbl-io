import {
  GAME,
  encode,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type Stroke,
} from "@skribbl/shared";
import { Emitter } from "./emitter";
import { buildRoomWsUrl } from "./url";
import {
  WS_OPEN,
  type ConnectionStatus,
  type Identity,
  type RoomConnectionOptions,
  type RoomEvents,
  type WebSocketFactory,
  type WebSocketLike,
} from "./types";

const DEFAULT_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
/** If we don't see a `pong` within this window after a `ping`, force a reconnect. */
const HEARTBEAT_TIMEOUT_MS = 10_000;

function defaultSocketFactory(url: string): WebSocketLike {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
  if (!Ctor) {
    throw new Error(
      "No global WebSocket available. Pass `socketFactory` in RoomConnectionOptions.",
    );
  }
  return new Ctor(url);
}

/**
 * Typed, self-healing WebSocket client for a single game room.
 *
 * Responsibilities:
 * - open the socket and send `join` as the very first frame (contract rule);
 * - validate EVERY inbound frame with `parseServerMessage` and re-emit it as a
 *   strongly-typed event (invalid frames become a `parse-error` event, never a
 *   crash);
 * - send outbound frames from the typed `ClientMessage` union via `encode`;
 * - auto-reconnect with exponential backoff and re-`join` on reconnect;
 * - heartbeat with `ping`/`pong` on `GAME.HEARTBEAT_INTERVAL_MS`.
 *
 * It is intentionally framework-agnostic (no React, no zustand) so it can be
 * unit-tested against the mock server in plain Node. The React `useRoomConnection`
 * hook and the zustand store sit on top of this.
 */
export class RoomConnection {
  readonly roomId: string;
  readonly identity: Identity;
  /** Server-assigned id for the local player, set from the first `room:state`. */
  youId: string | null = null;

  private readonly events = new Emitter<RoomEvents>();
  private readonly socketFactory: WebSocketFactory;
  private readonly baseUrl?: string;
  private readonly autoReconnect: boolean;
  private readonly heartbeatIntervalMs: number;

  private ws: WebSocketLike | null = null;
  private _status: ConnectionStatus = "idle";
  private intentionalClose = false;
  private attempt = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RoomConnectionOptions) {
    this.roomId = options.roomId;
    this.identity = options.identity;
    this.baseUrl = options.baseUrl;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.autoReconnect = options.autoReconnect ?? true;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? GAME.HEARTBEAT_INTERVAL_MS;
  }

  /* ---------------- public API ---------------- */

  get status(): ConnectionStatus {
    return this._status;
  }

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends keyof RoomEvents>(event: K, listener: (payload: RoomEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  /** Open the socket. Safe to call once; use {@link disconnect} to tear down. */
  connect(): void {
    if (this.ws) return;
    this.intentionalClose = false;
    this.open();
  }

  /** Close the socket for good (no reconnect). Sends a polite `leave` first. */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnect();
    this.stopHeartbeat();
    if (this.ws && this.ws.readyState === WS_OPEN) {
      this.rawSend({ type: "leave" });
    }
    this.teardownSocket();
    this.setStatus("closed");
  }

  /** Send any typed client message. Drops the frame (returns false) if not open. */
  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WS_OPEN) return false;
    this.rawSend(message);
    return true;
  }

  /* ---- typed send helpers (the surface the UI actually calls) ---- */

  start(): boolean {
    return this.send({ type: "start" });
  }

  selectWord(word: string): boolean {
    return this.send({ type: "select-word", word });
  }

  sendDraw(stroke: Stroke): boolean {
    return this.send({ type: "draw", stroke });
  }

  clear(): boolean {
    return this.send({ type: "draw:clear" });
  }

  undo(): boolean {
    return this.send({ type: "draw:undo" });
  }

  sendChat(text: string): boolean {
    return this.send({ type: "chat", text });
  }

  react(emoji: string): boolean {
    return this.send({ type: "react", emoji });
  }

  updateSettings(settings: Extract<ClientMessage, { type: "settings:update" }>["settings"]): boolean {
    return this.send({ type: "settings:update", settings });
  }

  kick(playerId: string): boolean {
    return this.send({ type: "kick", playerId });
  }

  leave(): boolean {
    return this.send({ type: "leave" });
  }

  /* ---------------- socket lifecycle ---------------- */

  private open(): void {
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    let socket: WebSocketLike;
    try {
      socket = this.socketFactory(buildRoomWsUrl(this.roomId, this.baseUrl));
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus("open");
      // Contract: the FIRST frame after connect MUST be `join`.
      this.rawSend({ type: "join", nickname: this.identity.nickname, avatar: this.identity.avatar });
      this.startHeartbeat();
    };

    socket.onmessage = (event) => this.handleRaw(event.data);

    socket.onerror = () => {
      // Transport errors are followed by a close; let onclose drive reconnect.
    };

    socket.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.intentionalClose || !this.autoReconnect) {
        if (!this.intentionalClose) this.setStatus("closed");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private handleRaw(data: unknown): void {
    const raw = typeof data === "string" ? data : String(data);
    const parsed = parseServerMessage(raw);
    if (!parsed.ok) {
      this.events.emit("parse-error", { raw, error: parsed.error });
      return;
    }
    this.dispatch(parsed.data);
  }

  private dispatch(message: ServerMessage): void {
    if (message.type === "room:state") {
      this.youId = message.youId;
    }
    if (message.type === "pong") {
      this.clearPongTimer();
    }
    // Generic firehose first (drives the store), then the strongly-typed event.
    this.events.emit("message", message);
    this.events.emit(message.type, message as RoomEvents[typeof message.type]);
  }

  private rawSend(message: ClientMessage): void {
    try {
      this.ws?.send(encode(message));
    } catch {
      // A send failure means the socket is dying; onclose will reconnect.
    }
  }

  /* ---------------- reconnect ---------------- */

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.setStatus("reconnecting");
    const delay = Math.min(DEFAULT_BACKOFF_MS * 2 ** this.attempt, MAX_BACKOFF_MS);
    this.attempt += 1;
    // Full jitter keeps a thundering herd from hammering the DO in lockstep.
    const jittered = Math.round(Math.random() * delay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionalClose) this.open();
    }, jittered);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /* ---------------- heartbeat ---------------- */

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WS_OPEN) return;
      this.rawSend({ type: "ping" });
      // Expect a `pong` shortly; otherwise assume a half-open socket and recycle.
      // Only arm the timeout if one is not already pending — otherwise every
      // heartbeat tick would reset the timeout before it can ever fire, and a
      // dead socket would never be recycled.
      if (this.pongTimer === null) {
        this.pongTimer = setTimeout(() => {
          this.recycleSocket();
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /** Force-close a presumed-dead socket so `onclose` triggers a reconnect. */
  private recycleSocket(): void {
    const socket = this.ws;
    this.stopHeartbeat();
    if (socket) {
      try {
        socket.close();
      } catch {
        // If close throws, drive the reconnect ourselves.
        this.ws = null;
        if (!this.intentionalClose && this.autoReconnect) this.scheduleReconnect();
      }
    }
  }

  private teardownSocket(): void {
    const socket = this.ws;
    this.ws = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch {
      // ignore
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    this._status = status;
    this.events.emit("status", status);
  }
}
