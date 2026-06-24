/**
 * Phase 4 QA — load test for the Cloudflare Durable Object backend.
 *
 * Spins up N concurrent rooms, each with M WebSocket clients, and drives a
 * minimal game loop (join → start → choose → draw → guess → reveal) to
 * sanity-check DO behavior and broadcast cost under load. Run against
 * `wrangler dev` or a deployed Worker.
 *
 * Usage:
 *   pnpm --filter @skribbl/api dev           # start the backend
 *   pnpm --filter @skribbl/tests load         # run the load test
 *
 * Env vars:
 *   LOAD_API_URL   — HTTP base (default http://localhost:8787)
 *   LOAD_ROOMS     — number of concurrent rooms (default 5)
 *   LOAD_CLIENTS   — clients per room (default 3)
 *   LOAD_ROUNDS    — rounds per room (default 1)
 */
import { WebSocket } from "ws";
import {
  encode,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "@skribbl/shared";

const API_URL = process.env.LOAD_API_URL ?? "http://localhost:8787";
const WS_URL = API_URL.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
const NUM_ROOMS = parseInt(process.env.LOAD_ROOMS ?? "5", 10);
const CLIENTS_PER_ROOM = parseInt(process.env.LOAD_CLIENTS ?? "3", 10);
const ROUNDS = parseInt(process.env.LOAD_ROUNDS ?? "1", 10);

interface LoadClient {
  ws: WebSocket;
  youId: string | null;
  word: string | null;
  choices: string[] | null;
  phase: string;
  messages: ServerMessage[];
  nickname: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${API_URL}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("backend did not become healthy");
}

async function createRoom(): Promise<string> {
  const resp = await fetch(`${API_URL}/api/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ maxRounds: ROUNDS, roundDurationSec: 30, hintsEnabled: false }),
  });
  if (!resp.ok) throw new Error(`createRoom failed: ${resp.status}`);
  const json = (await resp.json()) as { roomId: string };
  return json.roomId;
}

function makeClient(roomId: string, nickname: string): LoadClient {
  const ws = new WebSocket(`${WS_URL}/api/rooms/${roomId}/ws`);
  const client: LoadClient = {
    ws,
    youId: null,
    word: null,
    choices: null,
    phase: "lobby",
    messages: [],
    nickname,
  };
  ws.on("open", () => {
    send(client, { type: "join", nickname, avatar: { emoji: "🐙", color: "#4F46E5" } });
  });
  ws.on("message", (raw) => {
    const parsed = parseServerMessage(raw.toString());
    if (!parsed.ok) return;
    const msg = parsed.data;
    client.messages.push(msg);
    if (msg.type === "room:state") {
      client.youId = msg.youId;
      client.phase = msg.state.phase;
    }
    if (msg.type === "turn:choosing" && Array.isArray(msg.choices)) client.choices = msg.choices;
    if (msg.type === "turn:start" && msg.word != null) client.word = msg.word;
  });
  return client;
}

function send(client: LoadClient, msg: ClientMessage): void {
  try {
    client.ws.send(encode(msg));
  } catch {
    /* socket closing */
  }
}

function waitFor(client: LoadClient, predicate: (msg: ServerMessage) => boolean, timeoutMs = 15_000, minIndex = 0): Promise<ServerMessage | null> {
  return new Promise((resolve) => {
    const check = () => client.messages.slice(minIndex).find(predicate);
    const existing = check();
    if (existing) {
      resolve(existing);
      return;
    }
    const interval = setInterval(() => {
      const found = check();
      if (found) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve(found);
      }
    }, 50);
    const timer = setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, timeoutMs);
  });
}

async function playRoom(roomId: string, roomIdx: number): Promise<{ room: string; ok: boolean; turns: number; durationMs: number; error?: string }> {
  const start = Date.now();
  const nicknames = Array.from({ length: CLIENTS_PER_ROOM }, (_, i) => `R${roomIdx}P${i}`);
  const clients = nicknames.map((n) => makeClient(roomId, n));

  try {
    // Wait for all clients to join.
    await Promise.all(clients.map((c) => waitFor(c, (m) => m.type === "room:state")));
    if (clients.some((c) => !c.youId)) throw new Error("not all clients joined");

    // Find the host (the first joiner) from the room:state messages.
    const hostClient = clients.find((c) => {
      const state = c.messages.find((m) => m.type === "room:state") as Extract<ServerMessage, { type: "room:state" }> | undefined;
      return state?.state.hostId === c.youId;
    });
    if (!hostClient) throw new Error("could not identify the host");

    // Host starts.
    send(hostClient, { type: "start" });

    const totalTurns = CLIENTS_PER_ROOM * ROUNDS;
    for (let turn = 0; turn < totalTurns; turn += 1) {
      // Track the message index at the start of this turn so waitFor only
      // looks at NEW messages (not the previous turn's).
      const minIdx = clients.map((c) => c.messages.length);

      // Wait for choosing.
      await Promise.all(clients.map((c, i) => waitFor(c, (m) => m.type === "turn:choosing", 25_000, minIdx[i])));
      const drawer = clients.find((c) => c.choices !== null && c.choices.length > 0);
      if (!drawer || !drawer.choices) throw new Error(`turn ${turn}: no drawer with choices`);
      const word = drawer.choices[0]!;
      send(drawer, { type: "select-word", word });

      // Wait for drawing.
      await Promise.all(clients.map((c, i) => waitFor(c, (m) => m.type === "turn:start", 25_000, minIdx[i])));
      const drawerWord = clients.find((c) => c.word !== null)?.word;
      if (!drawerWord) throw new Error(`turn ${turn}: no word received by drawer`);

      // Drawer sends a few draw frames.
      for (let i = 0; i < 5; i += 1) {
        send(drawer, {
          type: "draw",
          stroke: {
            points: [{ x: i / 10, y: 0.5 }, { x: (i + 1) / 10, y: 0.5 }],
            color: "#000000",
            width: 4,
            mode: "draw",
          },
        });
      }

      // Guessers guess the word.
      const guessers = clients.filter((c) => c !== drawer);
      for (const g of guessers) send(g, { type: "chat", text: drawerWord });

      // Wait for reveal.
      const reveals = await Promise.all(clients.map((c, i) => waitFor(c, (m) => m.type === "turn:reveal", 25_000, minIdx[i])));
      if (reveals.some((r) => r === null)) throw new Error(`turn ${turn}: no reveal`);

      // Reset per-turn state.
      for (const c of clients) {
        c.choices = null;
        c.word = null;
      }
    }

    // Wait for game over.
    const finalMinIdx = clients.map((c) => c.messages.length);
    const overs = await Promise.all(clients.map((c, i) => waitFor(c, (m) => m.type === "game:over", 25_000, finalMinIdx[i])));
    if (overs.some((o) => o === null)) throw new Error("no game:over received");

    for (const c of clients) c.ws.close();
    return { room: roomId, ok: true, turns: totalTurns, durationMs: Date.now() - start };
  } catch (err) {
    for (const c of clients) {
      try {
        c.ws.close();
      } catch {
        /* ignore */
      }
    }
    return {
      room: roomId,
      ok: false,
      turns: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  console.log(`\nLoad test: ${NUM_ROOMS} rooms × ${CLIENTS_PER_ROOM} clients × ${ROUNDS} round(s)`);
  console.log(`Backend: ${API_URL}\n`);

  await waitForHealth();
  console.log("Backend healthy. Creating rooms…");

  // Create all rooms upfront (rate limit is 15/min, so keep NUM_ROOMS <= 15).
  const roomIds: string[] = [];
  for (let i = 0; i < NUM_ROOMS; i += 1) {
    try {
      roomIds.push(await createRoom());
    } catch (err) {
      console.error(`Failed to create room ${i}:`, err);
    }
  }
  console.log(`Created ${roomIds.length}/${NUM_ROOMS} rooms.\n`);

  // Run all rooms concurrently.
  const t0 = Date.now();
  const results = await Promise.all(roomIds.map((roomId, i) => playRoom(roomId, i)));
  const totalMs = Date.now() - t0;

  // Report.
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const totalTurns = ok.reduce((sum, r) => sum + r.turns, 0);
  const totalClients = NUM_ROOMS * CLIENTS_PER_ROOM;
  const totalMessages = results.reduce((sum, r) => sum + (r.ok ? r.turns * CLIENTS_PER_ROOM * 8 : 0), 0);

  console.log("─".repeat(60));
  console.log(`Rooms: ${ok.length} ok / ${fail.length} failed / ${NUM_ROOMS} total`);
  console.log(`Clients: ${totalClients} concurrent across ${roomIds.length} rooms`);
  console.log(`Turns completed: ${totalTurns}`);
  console.log(`Approx messages exchanged: ${totalMessages}`);
  console.log(`Total wall time: ${(totalMs / 1000).toFixed(1)}s`);
  if (ok.length > 0) {
    const avgMs = ok.reduce((s, r) => s + r.durationMs, 0) / ok.length;
    const maxMs = Math.max(...ok.map((r) => r.durationMs));
    console.log(`Avg room duration: ${(avgMs / 1000).toFixed(1)}s`);
    console.log(`Max room duration: ${(maxMs / 1000).toFixed(1)}s`);
  }
  if (fail.length > 0) {
    console.log("\nFailures:");
    for (const f of fail) console.log(`  ${f.room}: ${f.error}`);
  }
  console.log("─".repeat(60));

  const code = fail.length > 0 ? 1 : 0;
  process.exit(code);
}

main().catch((err) => {
  console.error("load test crashed:", err);
  process.exit(1);
});
