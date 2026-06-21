/**
 * Standalone end-to-end verification for the realtime client against the mock
 * server. NOT shipped in the app and NOT part of any test runner — run manually:
 *
 *   pnpm mock                 # terminal 1 (repo root)
 *   pnpm --filter @skribbl/mock-ws-server exec tsx \
 *     ../../apps/mobile/lib/realtime/__verify__/connection.verify.ts
 *
 * It drives two RoomConnections (a drawer/host + a guesser) through the full
 * turn loop and asserts: join-first handshake, frame validation, draw mirroring,
 * correct-guess scoring, anti-cheat masking, ping/pong, and reconnect.
 *
 * Uses Node 22's global WebSocket, so no extra deps are required.
 */
import type { ServerMessage, Stroke } from "@skribbl/shared";
import { RoomConnection } from "../RoomConnection";
import type { Identity } from "../types";

// Node-only globals via globalThis so this standalone script never depends on
// @types/node and never breaks the app's typecheck (it is excluded from bundling).
const proc = (
  globalThis as unknown as {
    process?: { env?: Record<string, string | undefined>; exit?: (code?: number) => never };
  }
).process;

const BASE = proc?.env?.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8787";
const ROOM = `VERIFY${Math.floor(Math.random() * 9000 + 1000)}`;

let failures = 0;
function check(label: string, cond: boolean): void {
  console.log(`${cond ? "  ok  " : " FAIL "} ${label}`);
  if (!cond) failures += 1;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve when `conn` emits `type`, or reject after `timeoutMs`. */
function next<K extends ServerMessage["type"]>(
  conn: RoomConnection,
  type: K,
  timeoutMs = 4000,
): Promise<Extract<ServerMessage, { type: K }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error(`timed out waiting for "${type}"`));
    }, timeoutMs);
    const off = conn.on(type, (payload) => {
      clearTimeout(timer);
      off();
      resolve(payload as unknown as Extract<ServerMessage, { type: K }>);
    });
  });
}

const drawerIdentity: Identity = { nickname: "Drawer", avatar: { emoji: "🎨", color: "#4F46E5" } };
const guesserIdentity: Identity = { nickname: "Guesser", avatar: { emoji: "👀", color: "#16A34A" } };

async function main(): Promise<void> {
  console.log(`\nVerifying realtime client against ${BASE} (room ${ROOM})\n`);

  const drawer = new RoomConnection({ roomId: ROOM, identity: drawerIdentity, baseUrl: BASE });
  const guesser = new RoomConnection({ roomId: ROOM, identity: guesserIdentity, baseUrl: BASE });

  let drawerParseErrors = 0;
  let guesserParseErrors = 0;
  drawer.on("parse-error", () => (drawerParseErrors += 1));
  guesser.on("parse-error", () => (guesserParseErrors += 1));

  // --- join handshake ---
  const drawerState = next(drawer, "room:state");
  drawer.connect();
  const ds = await drawerState;
  check("drawer receives room:state with youId", Boolean(ds.youId));
  check("drawer is host", ds.state.hostId === ds.youId);
  check("drawer status is open", drawer.status === "open");

  const guesserState = next(guesser, "room:state");
  guesser.connect();
  const gs = await guesserState;
  check("guesser receives room:state with youId", Boolean(gs.youId));
  check("two players in room", gs.state.players.length === 2);

  // --- start → choosing ---
  const drawerChoosing = next(drawer, "turn:choosing");
  const guesserChoosing = next(guesser, "turn:choosing");
  await wait(50);
  drawer.start();
  const [dc, gc] = await Promise.all([drawerChoosing, guesserChoosing]);
  check("drawer receives choices (drawer-only)", Array.isArray(dc.choices) && dc.choices.length > 0);
  check("guesser does NOT receive choices (anti-cheat)", gc.choices === null);
  check("choosing has phaseEndsAt for countdown", typeof dc.phaseEndsAt === "number");

  // --- select word → drawing ---
  const word = dc.choices?.[0] ?? "apple";
  const drawerStart = next(drawer, "turn:start");
  const guesserStart = next(guesser, "turn:start");
  drawer.selectWord(word);
  const [dStart, gStart] = await Promise.all([drawerStart, guesserStart]);
  check("drawer turn:start includes the full word", dStart.word === word);
  check("guesser turn:start hides the word (anti-cheat)", gStart.word === null);
  check("guesser gets maskedWord + wordLength", gStart.wordLength === word.length && typeof gStart.maskedWord === "string");

  // --- draw mirroring ---
  const stroke: Stroke = {
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.2 },
    ],
    color: "#000000",
    width: 6,
    mode: "draw",
  };
  const mirrored = next(guesser, "draw");
  drawer.sendDraw(stroke);
  const drawMsg = await mirrored;
  check("guesser receives mirrored draw frame", drawMsg.stroke.points.length === 3);
  check("mirrored stroke keeps normalized coords", drawMsg.stroke.points[0]?.x === 0.1);
  check("draw frame is attributed to the drawer", drawMsg.playerId === ds.youId);

  // --- correct guess scoring ---
  const correct = next(guesser, "guess:correct");
  guesser.sendChat(word);
  const correctMsg = await correct;
  check("guess:correct broadcast with points", correctMsg.points > 0 && correctMsg.nickname === "Guesser");

  // --- ping / pong ---
  const pong = next(drawer, "pong");
  drawer.send({ type: "ping" });
  await pong;
  check("server answers ping with pong", true);

  // --- reconnect (force-close the socket; expect auto re-join) ---
  const reJoined = next(guesser, "room:state", 8000);
  // Reach into the private socket to simulate a transport drop.
  (guesser as unknown as { ws: { close: () => void } | null }).ws?.close();
  const rs = await reJoined;
  check("guesser auto-reconnects and re-joins", Boolean(rs.youId));
  check("guesser status back to open after reconnect", guesser.status === "open");

  check("no parse errors on drawer", drawerParseErrors === 0);
  check("no parse errors on guesser", guesserParseErrors === 0);

  // --- heartbeat loop (short interval so it actually fires) ---
  const hb = new RoomConnection({
    roomId: `${ROOM}HB`,
    identity: guesserIdentity,
    baseUrl: BASE,
    heartbeatIntervalMs: 150,
  });
  let pongs = 0;
  hb.on("pong", () => (pongs += 1));
  const hbReady = next(hb, "room:state");
  hb.connect();
  await hbReady;
  await wait(550); // ~3 heartbeat cycles
  check("heartbeat ping/pong keeps the socket alive", pongs >= 2 && hb.status === "open");
  hb.disconnect();

  drawer.disconnect();
  guesser.disconnect();
  await wait(100);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  proc?.exit?.(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("verify harness crashed:", err);
  proc?.exit?.(1);
});
