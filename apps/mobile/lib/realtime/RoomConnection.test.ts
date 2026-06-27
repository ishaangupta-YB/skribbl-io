import { describe, expect, it, vi } from "vitest";
import { encode, type ServerMessage } from "@skribbl/shared";
import { RoomConnection } from "./RoomConnection";
import type { Identity, WebSocketLike } from "./types";

const IDENT: Identity = { nickname: "Tester", avatar: { emoji: "🐙", color: "#4F46E5" } };

/** A minimal in-process WebSocket double. */
class FakeSocket implements WebSocketLike {
  readyState = 0; // CONNECTING
  onopen: WebSocketLike["onopen"] = null;
  onclose: WebSocketLike["onclose"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  sent: string[] = [];
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.({} as unknown as never);
  });
  send = vi.fn((data: string) => {
    this.sent.push(data);
  });
  /** Test helper: simulate the transport opening. */
  open(): void {
    this.readyState = 1;
    this.onopen?.({} as unknown as never);
  }
  /** Test helper: deliver a server frame. */
  deliver(msg: ServerMessage): void {
    this.onmessage?.({ data: encode(msg) } as unknown as { data: unknown });
  }
  /** Test helper: deliver raw (possibly invalid) text. */
  deliverRaw(raw: string): void {
    this.onmessage?.({ data: raw } as unknown as { data: unknown });
  }
}

function makeConn(opts: { autoReconnect?: boolean; heartbeatIntervalMs?: number } = {}) {
  const socket = new FakeSocket();
  const conn = new RoomConnection({
    roomId: "ROOM",
    identity: IDENT,
    socketFactory: () => socket,
    autoReconnect: opts.autoReconnect ?? false,
    heartbeatIntervalMs: opts.heartbeatIntervalMs ?? 60_000,
  });
  return { conn, socket };
}

describe("RoomConnection — lifecycle", () => {
  it("starts in idle and moves to connecting on connect()", () => {
    const { conn } = makeConn();
    expect(conn.status).toBe("idle");
    conn.connect();
    expect(conn.status).toBe("connecting");
  });

  it("sends join as the very first frame on open (contract rule)", () => {
    const { conn, socket } = makeConn();
    conn.connect();
    socket.open();
    expect(socket.sent.length).toBeGreaterThanOrEqual(1);
    const first = JSON.parse(socket.sent[0]!) as { type: string };
    expect(first.type).toBe("join");
  });

  it("moves to open after the socket opens", () => {
    const { conn, socket } = makeConn();
    conn.connect();
    socket.open();
    expect(conn.status).toBe("open");
  });

  it("disconnect() sends leave, closes the socket, and sets status to closed", () => {
    const { conn, socket } = makeConn();
    conn.connect();
    socket.open();
    conn.disconnect();
    expect(socket.sent.some((s) => JSON.parse(s).type === "leave")).toBe(true);
    expect(socket.close).toHaveBeenCalled();
    expect(conn.status).toBe("closed");
  });
});

describe("RoomConnection — frame validation", () => {
  it("emits a typed event for a valid server message", () => {
    const { conn, socket } = makeConn();
    const listener = vi.fn();
    conn.on("room:state", listener);
    conn.connect();
    socket.open();
    socket.deliver({
      type: "room:state",
      youId: "p1",
      state: {
        roomId: "ROOM",
        phase: "lobby",
        settings: {
          maxPlayers: 20,
          maxRounds: 3,
          roundDurationSec: 70,
          wordPackIds: ["default"],
          customWords: [],
          isPublic: false,
          hintsEnabled: true,
        },
        players: [],
        hostId: null,
        currentRound: 0,
        drawerId: null,
        maskedWord: null,
        wordLength: null,
        phaseEndsAt: null,
      },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(conn.youId).toBe("p1");
  });

  it("emits parse-error for invalid JSON and never throws", () => {
    const { conn, socket } = makeConn();
    const parseErrors = vi.fn();
    conn.on("parse-error", parseErrors);
    conn.connect();
    socket.open();
    socket.deliverRaw("not json");
    expect(parseErrors).toHaveBeenCalledTimes(1);
  });

  it("emits parse-error for a wrong-shape JSON frame", () => {
    const { conn, socket } = makeConn();
    const parseErrors = vi.fn();
    conn.on("parse-error", parseErrors);
    conn.connect();
    socket.open();
    socket.deliverRaw(JSON.stringify({ type: "totally-fake" }));
    expect(parseErrors).toHaveBeenCalledTimes(1);
  });
});

describe("RoomConnection — typed send helpers", () => {
  it("start / selectWord / sendDraw / sendChat encode the right types", () => {
    const { conn, socket } = makeConn();
    conn.connect();
    socket.open();
    conn.start();
    conn.selectWord("cat");
    conn.sendDraw({ points: [{ x: 0.1, y: 0.1 }], color: "#000000", width: 4, mode: "draw" });
    conn.sendChat("hello");
    const types = socket.sent.slice(1).map((s) => (JSON.parse(s) as { type: string }).type);
    expect(types).toContain("start");
    expect(types).toContain("select-word");
    expect(types).toContain("draw");
    expect(types).toContain("chat");
  });

  it("send() returns false when the socket is not open", () => {
    const { conn } = makeConn();
    expect(conn.send({ type: "ping" })).toBe(false);
  });
});

describe("RoomConnection — reconnect", () => {
  it("schedules a reconnect after an unintentional close (when enabled)", () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const sockets = [socket, new FakeSocket()];
      let i = 0;
      const conn = new RoomConnection({
        roomId: "ROOM",
        identity: IDENT,
        socketFactory: () => sockets[i++]!,
        autoReconnect: true,
        heartbeatIntervalMs: 60_000,
      });
      conn.connect();
      socket.open();
      // Simulate a transport drop.
      socket.readyState = 3;
      socket.onclose?.({} as unknown as never);
      expect(conn.status).toBe("reconnecting");
      // Advance past the backoff window; the next socket opens and re-joins.
      vi.advanceTimersByTime(15_000);
      sockets[1]!.open();
      expect(conn.status).toBe("open");
      const firstFrame = JSON.parse(sockets[1]!.sent[0]!) as { type: string };
      expect(firstFrame.type).toBe("join");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reconnect after an intentional disconnect", () => {
    const { conn, socket } = makeConn({ autoReconnect: true });
    conn.connect();
    socket.open();
    conn.disconnect();
    expect(conn.status).toBe("closed");
  });
});

describe("RoomConnection — heartbeat", () => {
  it("sends a ping on each heartbeat tick and recycles the socket if no pong arrives", () => {
    vi.useFakeTimers();
    try {
      const { conn, socket } = makeConn({ heartbeatIntervalMs: 100 });
      conn.connect();
      socket.open();
      const pingsBefore = socket.sent.filter((s) => JSON.parse(s).type === "ping").length;
      vi.advanceTimersByTime(120);
      const pingsAfter = socket.sent.filter((s) => JSON.parse(s).type === "ping").length;
      expect(pingsAfter).toBeGreaterThan(pingsBefore);
      // No pong → after HEARTBEAT_TIMEOUT_MS the socket is force-closed.
      vi.advanceTimersByTime(10_500);
      expect(socket.close).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a pong clears the heartbeat-timeout timer (no recycle)", () => {
    vi.useFakeTimers();
    try {
      const { conn, socket } = makeConn({ heartbeatIntervalMs: 100 });
      // Auto-respond to every ping with a pong so the timeout never fires.
      socket.send = vi.fn((data: string) => {
        socket.sent.push(data);
        const msg = JSON.parse(data) as { type: string };
        if (msg.type === "ping") socket.deliver({ type: "pong" });
      });
      conn.connect();
      socket.open();
      // Drive many heartbeat cycles; pongs keep the socket alive.
      vi.advanceTimersByTime(30_000);
      expect(socket.close).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
