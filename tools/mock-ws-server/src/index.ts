/**
 * Local mock of the Cloudflare Durable Object game server.
 *
 * It speaks the exact @skribbl/shared WebSocket protocol so the Expo client
 * (Agents B/C/D) can be built and tested before the real backend (Agent A) is
 * ready. It is NOT production code — no persistence, no auth, single process.
 *
 * Connect with:  ws://localhost:8787/api/rooms/<ROOM_ID>/ws
 * Health check:  GET http://localhost:8787/health
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import {
  GAME,
  advanceTurn,
  calculateDrawerScore,
  calculateGuesserScore,
  clamp,
  collectWords,
  defaultRoomSettings,
  encode,
  getRandomWords,
  isCloseGuess,
  isExactGuess,
  maskWord,
  maxHintLetters,
  parseClientMessage,
  revealLetters,
  type Avatar,
  type ChatKind,
  type ClientMessage,
  type ErrorCode,
  type GamePhase,
  type Player,
  type PublicRoomState,
  type ScoreEntry,
  type ServerMessage,
} from "@skribbl/shared";

const PORT = Number(process.env.PORT ?? 8787);

interface Conn {
  ws: WebSocket;
  player: Player;
}

interface Room {
  id: string;
  settings: typeof defaultRoomSettings;
  conns: Map<string, Conn>;
  order: string[];
  hostId: string | null;
  phase: GamePhase;
  round: number;
  drawerIndex: number;
  word: string | null;
  wordChoices: string[] | null;
  usedWords: Set<string>;
  pool: string[];
  currentMask: string;
  phaseEndsAt: number | null;
  correctThisTurn: Set<string>;
  guessOrder: number;
  roundPoints: Map<string, number>;
  timer: ReturnType<typeof setTimeout> | null;
  hintTimer: ReturnType<typeof setInterval> | null;
}

const rooms = new Map<string, Room>();

/* ---------------- helpers ---------------- */

function getOrCreateRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = {
      id,
      settings: { ...defaultRoomSettings },
      conns: new Map(),
      order: [],
      hostId: null,
      phase: "lobby",
      round: 0,
      drawerIndex: 0,
      word: null,
      wordChoices: null,
      usedWords: new Set(),
      pool: [],
      currentMask: "",
      phaseEndsAt: null,
      correctThisTurn: new Set(),
      guessOrder: 0,
      roundPoints: new Map(),
      timer: null,
      hintTimer: null,
    };
    rooms.set(id, room);
  }
  return room;
}

function send(conn: Conn, msg: ServerMessage): void {
  if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(encode(msg));
}

function broadcast(room: Room, msg: ServerMessage, exceptId?: string): void {
  for (const [pid, conn] of room.conns) {
    if (pid !== exceptId) send(conn, msg);
  }
}

function sendError(room: Room, toId: string, code: ErrorCode, message: string): void {
  const conn = room.conns.get(toId);
  if (conn) send(conn, { type: "error", code, message });
}

function systemChat(room: Room, text: string, kind: ChatKind): void {
  broadcast(room, {
    type: "chat",
    message: { id: randomUUID(), playerId: null, nickname: "", text, kind, ts: Date.now() },
  });
}

function currentDrawerId(room: Room): string | null {
  return room.order[room.drawerIndex] ?? null;
}

function players(room: Room): Player[] {
  return room.order
    .map((pid) => room.conns.get(pid)?.player)
    .filter((p): p is Player => Boolean(p));
}

function scoreboard(room: Room): ScoreEntry[] {
  return players(room)
    .map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      score: p.score,
      roundPoints: room.roundPoints.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

function buildState(room: Room, forId: string): PublicRoomState {
  const isDrawer = forId === currentDrawerId(room);
  return {
    roomId: room.id,
    phase: room.phase,
    settings: room.settings,
    players: players(room),
    hostId: room.hostId,
    currentRound: room.round,
    drawerId: currentDrawerId(room),
    maskedWord:
      room.phase === "drawing"
        ? room.currentMask
        : room.word
          ? maskWord(room.word)
          : null,
    wordLength: room.word ? room.word.length : null,
    phaseEndsAt: room.phaseEndsAt,
    word: isDrawer ? room.word : null,
    wordChoices: isDrawer && room.phase === "choosing" ? room.wordChoices : null,
  };
}

function sendStateToAll(room: Room): void {
  for (const [pid, conn] of room.conns) {
    send(conn, { type: "room:state", state: buildState(room, pid), youId: pid });
  }
}

function clearTimers(room: Room): void {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  if (room.hintTimer) {
    clearInterval(room.hintTimer);
    room.hintTimer = null;
  }
}

function setPhaseTimer(room: Room, seconds: number, fn: () => void): void {
  room.phaseEndsAt = Date.now() + seconds * 1000;
  room.timer = setTimeout(fn, seconds * 1000);
}

/* ---------------- game flow ---------------- */

function handleStart(room: Room, fromId: string): void {
  if (fromId !== room.hostId) return sendError(room, fromId, "NOT_ALLOWED", "only the host can start");
  if (room.phase !== "lobby" && room.phase !== "game-over") return;
  if (room.order.length < GAME.MIN_PLAYERS_TO_START)
    return sendError(room, fromId, "NOT_ALLOWED", "need more players to start");

  for (const p of players(room)) p.score = 0;
  room.round = 1;
  room.drawerIndex = 0;
  room.usedWords = new Set();
  room.pool = collectWords(room.settings.wordPackIds, room.settings.customWords);
  if (room.pool.length === 0) room.pool = collectWords(["default"]);
  beginChoosing(room);
}

function beginChoosing(room: Room): void {
  clearTimers(room);
  room.phase = "choosing";
  room.word = null;
  room.currentMask = "";
  room.correctThisTurn = new Set();
  room.guessOrder = 0;
  room.roundPoints = new Map();

  const drawerId = currentDrawerId(room);
  for (const p of players(room)) {
    p.isDrawing = p.id === drawerId;
    p.hasGuessed = false;
  }
  room.wordChoices = getRandomWords(room.pool, GAME.WORD_CHOICE_COUNT, room.usedWords);

  setPhaseTimer(room, GAME.WORD_CHOICE_DURATION_SEC, () => {
    const auto = room.wordChoices?.[0] ?? room.pool[0] ?? "apple";
    beginDrawing(room, auto);
  });

  for (const [pid, conn] of room.conns) {
    send(conn, {
      type: "turn:choosing",
      drawerId: drawerId ?? "",
      round: room.round,
      durationSec: GAME.WORD_CHOICE_DURATION_SEC,
      phaseEndsAt: room.phaseEndsAt ?? Date.now(),
      choices: pid === drawerId ? room.wordChoices : null,
    });
  }
  sendStateToAll(room);
}

function handleSelectWord(room: Room, fromId: string, word: string): void {
  if (room.phase !== "choosing" || fromId !== currentDrawerId(room)) return;
  if (!room.wordChoices?.includes(word)) return;
  beginDrawing(room, word);
}

function beginDrawing(room: Room, word: string): void {
  clearTimers(room);
  room.phase = "drawing";
  room.word = word;
  room.usedWords.add(word.toLowerCase());
  room.currentMask = maskWord(word);
  room.correctThisTurn = new Set();
  room.guessOrder = 0;

  const drawerId = currentDrawerId(room);
  for (const p of players(room)) {
    p.isDrawing = p.id === drawerId;
    p.hasGuessed = false;
  }

  broadcast(room, { type: "draw:clear" });
  const dur = room.settings.roundDurationSec;
  setPhaseTimer(room, dur, () => endTurn(room));

  for (const [pid, conn] of room.conns) {
    const isDrawer = pid === drawerId;
    send(conn, {
      type: "turn:start",
      drawerId: drawerId ?? "",
      round: room.round,
      maskedWord: room.currentMask,
      wordLength: word.length,
      durationSec: dur,
      phaseEndsAt: room.phaseEndsAt ?? Date.now() + dur * 1000,
      word: isDrawer ? word : null,
    });
  }
  sendStateToAll(room);
  startHints(room);
}

function startHints(room: Room): void {
  if (!room.settings.hintsEnabled || !room.word) return;
  const word = room.word;
  const total = room.settings.roundDurationSec * 1000;
  const maxHints = maxHintLetters(word);
  if (maxHints <= 0) return;

  room.hintTimer = setInterval(() => {
    if (room.phase !== "drawing" || !room.phaseEndsAt) return;
    const remaining = room.phaseEndsAt - Date.now();
    const frac = clamp((total - remaining) / total, 0, 1);
    const hintFrac =
      frac <= GAME.HINT_START_FRACTION
        ? 0
        : (frac - GAME.HINT_START_FRACTION) / (1 - GAME.HINT_START_FRACTION);
    const count = Math.floor(maxHints * hintFrac);
    const mask = revealLetters(word, count);
    if (mask !== room.currentMask) {
      room.currentMask = mask;
      const drawerId = currentDrawerId(room);
      for (const [pid, conn] of room.conns) {
        if (pid !== drawerId) send(conn, { type: "turn:hint", maskedWord: mask });
      }
    }
  }, 1500);
}

function handleChat(room: Room, fromId: string, text: string): void {
  const conn = room.conns.get(fromId);
  if (!conn) return;
  const drawerId = currentDrawerId(room);
  const canGuess = room.phase === "drawing" && fromId !== drawerId && !room.correctThisTurn.has(fromId);

  if (canGuess && room.word) {
    if (isExactGuess(text, room.word)) {
      room.correctThisTurn.add(fromId);
      conn.player.hasGuessed = true;
      const total = room.settings.roundDurationSec * 1000;
      const remaining = room.phaseEndsAt ? room.phaseEndsAt - Date.now() : 0;
      const points = calculateGuesserScore({
        timeRemainingMs: remaining,
        totalTimeMs: total,
        guessOrder: room.guessOrder,
      });
      room.guessOrder += 1;
      conn.player.score += points;
      room.roundPoints.set(fromId, points);

      broadcast(room, { type: "guess:correct", playerId: fromId, nickname: conn.player.nickname, points });
      systemChat(room, `${conn.player.nickname} guessed the word!`, "correct");
      broadcast(room, { type: "scores:update", scores: scoreboard(room) });

      if (room.correctThisTurn.size >= room.order.length - 1) endTurn(room);
      return;
    }
    if (isCloseGuess(text, room.word)) {
      send(conn, {
        type: "chat",
        message: {
          id: randomUUID(),
          playerId: null,
          nickname: "",
          text: `"${text}" is close!`,
          kind: "close",
          ts: Date.now(),
        },
      });
    }
  }

  // Never echo the drawer accidentally typing the exact answer.
  if (room.phase === "drawing" && fromId === drawerId && room.word && isExactGuess(text, room.word)) return;

  broadcast(room, {
    type: "chat",
    message: {
      id: randomUUID(),
      playerId: fromId,
      nickname: conn.player.nickname,
      text,
      kind: "chat",
      ts: Date.now(),
    },
  });
}

function endTurn(room: Room): void {
  clearTimers(room);
  const word = room.word ?? "";
  const drawer = room.conns.get(currentDrawerId(room) ?? "");
  const totalGuessers = Math.max(0, room.order.length - 1);
  if (drawer) {
    const drawerScore = calculateDrawerScore({
      correctGuessers: room.correctThisTurn.size,
      totalGuessers,
    });
    drawer.player.score += drawerScore;
    room.roundPoints.set(drawer.player.id, drawerScore);
  }
  room.phase = "reveal";
  broadcast(room, { type: "turn:reveal", word, scores: scoreboard(room) });
  sendStateToAll(room);
  setPhaseTimer(room, GAME.TURN_REVEAL_DURATION_SEC, () => nextTurn(room));
}

function abortTurnDrawerLeft(room: Room): void {
  clearTimers(room);
  room.phase = "reveal";
  broadcast(room, { type: "turn:reveal", word: room.word ?? "", scores: scoreboard(room) });
  sendStateToAll(room);
  setPhaseTimer(room, GAME.TURN_REVEAL_DURATION_SEC, () => nextTurn(room));
}

function nextTurn(room: Room): void {
  const adv = advanceTurn({
    drawerIndex: room.drawerIndex,
    playerCount: room.order.length,
    currentRound: room.round,
    maxRounds: room.settings.maxRounds,
  });
  if (adv.phase === "game-over") {
    endGame(room);
    return;
  }
  room.drawerIndex = adv.drawerIndex;
  room.round = adv.currentRound;
  beginChoosing(room);
}

function endGame(room: Room): void {
  clearTimers(room);
  room.phase = "game-over";
  room.word = null;
  broadcast(room, { type: "game:over", leaderboard: scoreboard(room) });
  sendStateToAll(room);
  room.timer = setTimeout(() => {
    room.phase = "lobby";
    room.round = 0;
    room.drawerIndex = 0;
    room.roundPoints = new Map();
    for (const p of players(room)) {
      p.score = 0;
      p.isDrawing = false;
      p.hasGuessed = false;
    }
    sendStateToAll(room);
  }, GAME.ROUND_END_DURATION_SEC * 1000);
}

/* ---------------- connection lifecycle ---------------- */

function handleJoin(room: Room, ws: WebSocket, nickname: string, avatar: Avatar): string | null {
  if (room.conns.size >= room.settings.maxPlayers) {
    ws.send(encode({ type: "error", code: "ROOM_FULL", message: "room is full" }));
    return null;
  }
  const id = randomUUID();
  const isHost = room.order.length === 0;
  const player: Player = {
    id,
    nickname,
    avatar,
    score: 0,
    isHost,
    isDrawing: false,
    hasGuessed: false,
    connected: true,
  };
  const conn: Conn = { ws, player };
  room.conns.set(id, conn);
  room.order.push(id);
  if (isHost) room.hostId = id;

  send(conn, { type: "room:state", state: buildState(room, id), youId: id });
  broadcast(room, { type: "player:joined", player }, id);
  systemChat(room, `${nickname} joined`, "system");
  return id;
}

function handleLeave(room: Room, playerId: string): void {
  const idx = room.order.indexOf(playerId);
  if (idx === -1) return;
  const wasDrawer = playerId === currentDrawerId(room);
  room.order.splice(idx, 1);
  room.conns.delete(playerId);
  room.correctThisTurn.delete(playerId);

  if (room.hostId === playerId) {
    room.hostId = room.order[0] ?? null;
    const newHost = room.hostId ? room.conns.get(room.hostId) : undefined;
    if (newHost) {
      newHost.player.isHost = true;
      broadcast(room, { type: "host:changed", hostId: newHost.player.id });
    }
  }
  broadcast(room, { type: "player:left", playerId });

  if (room.order.length === 0) {
    clearTimers(room);
    rooms.delete(room.id);
    return;
  }
  if (idx < room.drawerIndex) room.drawerIndex -= 1;

  const active = room.phase === "choosing" || room.phase === "drawing";
  if (active && wasDrawer) {
    room.drawerIndex -= 1; // nextTurn() will advance into the freed slot
    abortTurnDrawerLeft(room);
    return;
  }
  if (room.phase !== "lobby" && room.phase !== "game-over" && room.order.length < GAME.MIN_PLAYERS_TO_START) {
    endGame(room);
    return;
  }
  sendStateToAll(room);
}

function handleMessage(room: Room, fromId: string, msg: ClientMessage): void {
  switch (msg.type) {
    case "start":
      handleStart(room, fromId);
      break;
    case "select-word":
      handleSelectWord(room, fromId, msg.word);
      break;
    case "draw":
      if (fromId === currentDrawerId(room) && room.phase === "drawing")
        broadcast(room, { type: "draw", playerId: fromId, stroke: msg.stroke }, fromId);
      break;
    case "draw:clear":
      if (fromId === currentDrawerId(room)) broadcast(room, { type: "draw:clear" }, fromId);
      break;
    case "draw:undo":
      if (fromId === currentDrawerId(room)) broadcast(room, { type: "draw:undo" }, fromId);
      break;
    case "chat":
      handleChat(room, fromId, msg.text);
      break;
    case "react":
      broadcast(room, { type: "react", playerId: fromId, emoji: msg.emoji });
      break;
    case "settings:update":
      if (fromId === room.hostId && room.phase === "lobby") {
        room.settings = { ...room.settings, ...msg.settings };
        sendStateToAll(room);
      }
      break;
    case "kick": {
      if (fromId === room.hostId && msg.playerId !== fromId) {
        const target = room.conns.get(msg.playerId);
        if (target) {
          send(target, { type: "error", code: "NOT_ALLOWED", message: "you were kicked" });
          target.ws.close();
          handleLeave(room, msg.playerId);
        }
      }
      break;
    }
    case "leave": {
      const conn = room.conns.get(fromId);
      handleLeave(room, fromId);
      conn?.ws.close();
      break;
    }
    case "ping": {
      const conn = room.conns.get(fromId);
      if (conn) send(conn, { type: "pong" });
      break;
    }
    case "join":
      break; // already joined
    default:
      break;
  }
}

function handleConnection(ws: WebSocket, roomId: string): void {
  const room = getOrCreateRoom(roomId);
  let playerId: string | null = null;

  ws.on("message", (raw: RawData) => {
    const parsed = parseClientMessage(raw.toString());
    if (!parsed.ok) {
      ws.send(encode({ type: "error", code: "INVALID_MESSAGE", message: parsed.error }));
      return;
    }
    const msg = parsed.data;
    if (!playerId) {
      if (msg.type !== "join") {
        ws.send(encode({ type: "error", code: "NOT_ALLOWED", message: "send a join message first" }));
        return;
      }
      playerId = handleJoin(room, ws, msg.nickname, msg.avatar);
      if (!playerId) ws.close();
      return;
    }
    handleMessage(room, playerId, msg);
  });

  ws.on("close", () => {
    if (playerId) handleLeave(room, playerId);
  });
  ws.on("error", () => {
    /* ignore transport errors in the mock */
  });
}

/* ---------------- http + ws bootstrap ---------------- */

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/u);
  if (!match) {
    socket.destroy();
    return;
  }
  const roomId = decodeURIComponent(match[1] as string).toUpperCase();
  wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws, roomId));
});

server.listen(PORT, () => {
  console.log(`[mock-ws-server] listening on http://localhost:${PORT}`);
  console.log(`[mock-ws-server] connect: ws://localhost:${PORT}/api/rooms/<ROOM_ID>/ws`);
});
