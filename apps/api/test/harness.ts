import { SELF, env, runDurableObjectAlarm } from "cloudflare:test";
import { encode, type Avatar, type ClientMessage, type ServerMessage } from "@skribbl/shared";

type ServerMsg = ServerMessage;
type MsgType = ServerMsg["type"];
type MsgOf<T extends MsgType> = Extract<ServerMsg, { type: T }>;

interface Waiter {
  predicate: (m: ServerMsg) => boolean;
  resolve: (m: ServerMsg) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  label: string;
}

const DEFAULT_AVATAR: Avatar = { emoji: "🐙", color: "#4F46E5" };

/** A test-side WebSocket client with predicate-based message awaiting. */
export class TestClient {
  readonly all: ServerMsg[] = [];
  private buffer: ServerMsg[] = [];
  private waiters: Waiter[] = [];

  constructor(
    readonly ws: WebSocket,
    readonly label: string,
  ) {
    ws.accept();
    ws.addEventListener("message", (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : "";
      const msg = JSON.parse(data) as ServerMsg;
      this.all.push(msg);
      const idx = this.waiters.findIndex((w) => w.predicate(msg));
      if (idx >= 0) {
        const [w] = this.waiters.splice(idx, 1);
        clearTimeout(w!.timer);
        w!.resolve(msg);
      } else {
        this.buffer.push(msg);
      }
    });
  }

  send(msg: ClientMessage): void {
    this.ws.send(encode(msg));
  }

  /** Resolve with the next buffered/incoming message of the given type. */
  waitFor<T extends MsgType>(type: T, timeoutMs = 3000): Promise<MsgOf<T>> {
    return this.waitMatch((m) => m.type === type, type, timeoutMs) as Promise<MsgOf<T>>;
  }

  /** Count messages of a type already received (does not consume). */
  countOf(type: MsgType): number {
    return this.all.filter((m) => m.type === type).length;
  }

  private waitMatch(predicate: (m: ServerMsg) => boolean, label: string, timeoutMs: number): Promise<ServerMsg> {
    const idx = this.buffer.findIndex(predicate);
    if (idx >= 0) {
      const [m] = this.buffer.splice(idx, 1);
      return Promise.resolve(m!);
    }
    return new Promise<ServerMsg>((resolve, reject) => {
      const timer = setTimeout(() => {
        const at = this.waiters.findIndex((w) => w.timer === timer);
        if (at >= 0) this.waiters.splice(at, 1);
        reject(new Error(`[${this.label}] timed out waiting for "${label}"`));
      }, timeoutMs);
      this.waiters.push({ predicate, resolve, reject, timer, label });
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

/** Open a WebSocket to a room through the Worker (Worker → GameRoom DO). */
export async function connect(roomId: string, label: string): Promise<TestClient> {
  const resp = await SELF.fetch(`https://test.local/api/rooms/${roomId}/ws`, {
    headers: { Upgrade: "websocket" },
  });
  if (!resp.webSocket) {
    throw new Error(`expected a WebSocket (status ${resp.status})`);
  }
  return new TestClient(resp.webSocket, label);
}

/** Connect + join, returning the client and its initial room:state. */
export async function join(roomId: string, nickname: string, avatar: Avatar = DEFAULT_AVATAR): Promise<{ client: TestClient; state: MsgOf<"room:state"> }> {
  const client = await connect(roomId, nickname);
  client.send({ type: "join", nickname, avatar });
  const state = await client.waitFor("room:state");
  return { client, state };
}

/** Fire the room DO's scheduled alarm (server-authoritative timer). */
export async function fireAlarm(roomId: string): Promise<boolean> {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
  return runDurableObjectAlarm(stub);
}

/** Create a room via POST /api/rooms with partial settings, returning its id. */
export async function createRoom(settings: Record<string, unknown>): Promise<string> {
  const resp = await SELF.fetch("https://test.local/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(settings),
  });
  const json = (await resp.json()) as { roomId: string };
  return json.roomId;
}

/** A masked word should reveal no letters (only underscores / spaces / punctuation). */
export function isFullyMasked(masked: string): boolean {
  return /[a-z0-9]/i.test(masked) === false;
}
