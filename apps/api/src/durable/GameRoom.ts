import { DurableObject } from "cloudflare:workers";
import {
  GAME,
  advanceTurn,
  calculateDrawerScore,
  calculateGuesserScore,
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
  type RoomSettings,
  type ScoreEntry,
  type ServerMessage,
} from "@skribbl/shared";
import type { Env } from "../env";
import { deleteLobbyRoom, upsertLobbyRoom } from "../db/queries";
import { buildWordPool } from "../lib/words";
import { invalidatePublicLobby, roomInitKey, type RoomInit } from "../lib/lobby";

type AlarmPurpose = "phase-end" | "hint" | null;

/**
 * The full authoritative room state. Serialised to DO storage on every change
 * so it survives hibernation/eviction. Sets/Maps from the mock are stored as
 * arrays/records to keep the snapshot JSON-serialisable.
 */
interface RoomState {
  roomId: string;
  initialized: boolean;
  isPublic: boolean;
  settings: RoomSettings;
  players: Record<string, Player>;
  /** Stable join order (drawer rotation follows this). */
  order: string[];
  hostId: string | null;
  phase: GamePhase;
  round: number;
  drawerIndex: number;
  word: string | null;
  wordChoices: string[] | null;
  usedWords: string[];
  pool: string[];
  currentMask: string;
  phaseEndsAt: number | null;
  correctThisTurn: string[];
  guessOrder: number;
  roundPoints: Record<string, number>;
  alarmPurpose: AlarmPurpose;
  hintsRevealed: number;
  hintMaxCount: number;
}

interface SocketAttachment {
  playerId: string;
}

const STORAGE_KEY = "room";

function freshRoomState(roomId: string, settings: RoomSettings, isPublic: boolean): RoomState {
  return {
    roomId,
    initialized: false,
    isPublic,
    settings,
    players: {},
    order: [],
    hostId: null,
    phase: "lobby",
    round: 0,
    drawerIndex: 0,
    word: null,
    wordChoices: null,
    usedWords: [],
    pool: [],
    currentMask: "",
    phaseEndsAt: null,
    correctThisTurn: [],
    guessOrder: 0,
    roundPoints: {},
    alarmPurpose: null,
    hintsRevealed: 0,
    hintMaxCount: 0,
  };
}

/**
 * One Durable Object per room. Owns the authoritative game state, drives every
 * timed transition with `storage.setAlarm()` (never setTimeout/setInterval), and
 * accepts hibernatable WebSockets. Behaviour mirrors `tools/mock-ws-server`, but
 * the timer is server-authoritative and the answer never leaks to guessers.
 */
export class GameRoom extends DurableObject<Env> {
  private room: RoomState;
  /** Per-invocation flags: whether to persist state / re-arm the alarm. */
  private dirty = false;
  private rearm = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.room = freshRoomState("", { ...defaultRoomSettings }, false);
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>(STORAGE_KEY);
      if (stored) this.room = stored;
    });
  }

  /* ----------------------------- HTTP / upgrade ---------------------------- */

  override async fetch(request: Request): Promise<Response> {
    const roomId = (request.headers.get("X-Room-Id") ?? "").toUpperCase();
    if (roomId && this.room.roomId !== roomId) {
      this.room.roomId = roomId;
      await this.save();
    }
    if (!this.room.initialized) {
      await this.initFromKV();
      this.room.initialized = true;
      await this.save();
    }

    if ((request.headers.get("Upgrade") ?? "").toLowerCase() !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernation API: lets the DO evict from memory while keeping the socket.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async initFromKV(): Promise<void> {
    if (!this.room.roomId) return;
    try {
      const raw = await this.env.KV.get(roomInitKey(this.room.roomId));
      if (!raw) return;
      const init = JSON.parse(raw) as Partial<RoomInit>;
      if (init.settings) this.room.settings = { ...this.room.settings, ...init.settings };
      if (typeof init.isPublic === "boolean") this.room.isPublic = init.isPublic;
    } catch {
      /* no init settings — defaults are fine */
    }
  }

  /* --------------------------- WebSocket handlers -------------------------- */

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.dirty = false;
    this.rearm = false;

    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.sendRaw(ws, { type: "error", code: "INVALID_MESSAGE", message: parsed.error });
      return;
    }
    const msg = parsed.data;
    const attachment = this.attachmentOf(ws);

    if (!attachment) {
      if (msg.type !== "join") {
        this.sendRaw(ws, { type: "error", code: "NOT_ALLOWED", message: "send a join message first" });
        return;
      }
      const id = this.handleJoin(ws, msg.nickname, msg.avatar);
      if (!id) {
        this.closeSocket(ws, 1011, "room full");
        return;
      }
      await this.afterMutation();
      return;
    }

    await this.handleMessage(attachment.playerId, msg);
    await this.afterMutation();
  }

  override async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    this.dirty = false;
    this.rearm = false;
    const attachment = this.attachmentOf(ws);
    if (attachment) this.handleLeave(attachment.playerId);
    await this.afterMutation();
  }

  override webSocketError(_ws: WebSocket, _error: unknown): void {
    /* transport-level errors are followed by webSocketClose; nothing to do */
  }

  /* -------------------------------- Alarms --------------------------------- */

  override async alarm(): Promise<void> {
    this.dirty = true;
    this.rearm = true;
    if (this.room.alarmPurpose === "hint") {
      this.revealNextHint();
    } else {
      this.onPhaseEnd();
    }
    await this.afterMutation();
  }

  private onPhaseEnd(): void {
    switch (this.room.phase) {
      case "choosing": {
        const auto = this.room.wordChoices?.[0] ?? this.room.pool[0] ?? "apple";
        this.beginDrawing(auto);
        break;
      }
      case "drawing":
        this.endTurn();
        break;
      case "reveal":
        this.nextTurn();
        break;
      case "game-over":
        this.resetToLobby();
        break;
      default:
        break;
    }
  }

  /** Schedule the single DO alarm at the next hint tick or the phase end. */
  private async armAlarm(): Promise<void> {
    const r = this.room;
    let at: number | null = null;
    let purpose: AlarmPurpose = null;

    if (r.phaseEndsAt !== null && r.phase !== "lobby") {
      at = r.phaseEndsAt;
      purpose = "phase-end";
      if (r.phase === "drawing" && r.settings.hintsEnabled && r.hintMaxCount > 0 && r.hintsRevealed < r.hintMaxCount) {
        const nextHint = this.nextHintTime();
        if (nextHint !== null && nextHint < r.phaseEndsAt) {
          at = nextHint;
          purpose = "hint";
        }
      }
    }

    r.alarmPurpose = purpose;
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }

  private nextHintTime(): number | null {
    const r = this.room;
    if (r.phaseEndsAt === null || r.hintMaxCount <= 0) return null;
    const durationMs = r.settings.roundDurationSec * 1000;
    const startMs = r.phaseEndsAt - durationMs;
    const k = r.hintsRevealed + 1;
    if (k > r.hintMaxCount) return null;
    // Letters reveal linearly between HINT_START_FRACTION and the phase end.
    const frac = GAME.HINT_START_FRACTION + (1 - GAME.HINT_START_FRACTION) * (k / r.hintMaxCount);
    return Math.round(startMs + durationMs * frac);
  }

  private revealNextHint(): void {
    const r = this.room;
    if (r.phase !== "drawing" || !r.word || r.hintsRevealed >= r.hintMaxCount) return;
    r.hintsRevealed += 1;
    r.currentMask = revealLetters(r.word, r.hintsRevealed);
    const drawerId = this.currentDrawerId();
    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.attachmentOf(ws)?.playerId;
      if (pid && pid !== drawerId) this.sendRaw(ws, { type: "turn:hint", maskedWord: r.currentMask });
    }
  }

  /* ----------------------------- Message router ---------------------------- */

  private async handleMessage(fromId: string, msg: ClientMessage): Promise<void> {
    const r = this.room;
    switch (msg.type) {
      case "start":
        await this.handleStart(fromId);
        break;
      case "select-word":
        this.handleSelectWord(fromId, msg.word);
        break;
      case "draw":
        if (fromId === this.currentDrawerId() && r.phase === "drawing") {
          this.broadcast({ type: "draw", playerId: fromId, stroke: msg.stroke }, fromId);
        }
        break;
      case "draw:clear":
        if (fromId === this.currentDrawerId()) this.broadcast({ type: "draw:clear" }, fromId);
        break;
      case "draw:undo":
        if (fromId === this.currentDrawerId()) this.broadcast({ type: "draw:undo" }, fromId);
        break;
      case "chat":
        this.handleChat(fromId, msg.text);
        break;
      case "react":
        this.broadcast({ type: "react", playerId: fromId, emoji: msg.emoji });
        break;
      case "settings:update":
        if (fromId === r.hostId && r.phase === "lobby") {
          r.settings = { ...r.settings, ...msg.settings };
          this.dirty = true;
          this.sendStateToAll();
          void this.updateRegistry();
        }
        break;
      case "kick":
        this.handleKick(fromId, msg.playerId);
        break;
      case "leave": {
        const ws = this.socketFor(fromId);
        this.handleLeave(fromId);
        if (ws) this.closeSocket(ws, 1000, "left");
        break;
      }
      case "ping":
        this.sendTo(fromId, { type: "pong" });
        break;
      case "join":
        break; // already joined
      default:
        break;
    }
  }

  /* ------------------------------- Game flow ------------------------------- */

  private handleJoin(ws: WebSocket, nickname: string, avatar: Avatar): string | null {
    const r = this.room;
    if (r.order.length >= r.settings.maxPlayers) {
      this.sendRaw(ws, { type: "error", code: "ROOM_FULL", message: "room is full" });
      return null;
    }
    const id = crypto.randomUUID();
    const isHost = r.order.length === 0;
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
    r.players[id] = player;
    r.order.push(id);
    if (isHost) r.hostId = id;

    ws.serializeAttachment({ playerId: id } satisfies SocketAttachment);
    this.sendRaw(ws, { type: "room:state", state: this.buildState(id), youId: id });
    this.broadcast({ type: "player:joined", player }, id);
    this.systemChat(`${nickname} joined`, "system");
    this.dirty = true;
    void this.updateRegistry();
    return id;
  }

  private async handleStart(fromId: string): Promise<void> {
    const r = this.room;
    if (fromId !== r.hostId) {
      this.sendError(fromId, "NOT_ALLOWED", "only the host can start");
      return;
    }
    if (r.phase !== "lobby" && r.phase !== "game-over") return;
    if (r.order.length < GAME.MIN_PLAYERS_TO_START) {
      this.sendError(fromId, "NOT_ALLOWED", "need more players to start");
      return;
    }

    const pool = await buildWordPool(this.env, r.settings);
    r.pool = pool.length > 0 ? pool : collectWords(["default"]);
    for (const p of this.playersList()) p.score = 0;
    r.round = 1;
    r.drawerIndex = 0;
    r.usedWords = [];
    this.beginChoosing();
  }

  private beginChoosing(): void {
    this.transition();
    const r = this.room;
    r.phase = "choosing";
    r.word = null;
    r.currentMask = "";
    r.correctThisTurn = [];
    r.guessOrder = 0;
    r.roundPoints = {};
    r.hintsRevealed = 0;
    r.hintMaxCount = 0;

    const drawerId = this.currentDrawerId();
    for (const p of this.playersList()) {
      p.isDrawing = p.id === drawerId;
      p.hasGuessed = false;
    }
    r.wordChoices = getRandomWords(r.pool, GAME.WORD_CHOICE_COUNT, r.usedWords);
    this.setPhaseEnd(GAME.WORD_CHOICE_DURATION_SEC);

    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.attachmentOf(ws)?.playerId;
      if (!pid) continue;
      this.sendRaw(ws, {
        type: "turn:choosing",
        drawerId: drawerId ?? "",
        round: r.round,
        durationSec: GAME.WORD_CHOICE_DURATION_SEC,
        phaseEndsAt: r.phaseEndsAt ?? Date.now(),
        choices: pid === drawerId ? r.wordChoices : null,
      });
    }
    this.sendStateToAll();
    void this.updateRegistry();
  }

  private handleSelectWord(fromId: string, word: string): void {
    const r = this.room;
    if (r.phase !== "choosing" || fromId !== this.currentDrawerId()) return;
    if (!r.wordChoices?.includes(word)) return;
    this.beginDrawing(word);
  }

  private beginDrawing(word: string): void {
    this.transition();
    const r = this.room;
    r.phase = "drawing";
    r.word = word;
    if (!r.usedWords.includes(word.toLowerCase())) r.usedWords.push(word.toLowerCase());
    r.currentMask = maskWord(word);
    r.correctThisTurn = [];
    r.guessOrder = 0;
    r.hintsRevealed = 0;
    r.hintMaxCount = r.settings.hintsEnabled ? maxHintLetters(word) : 0;

    const drawerId = this.currentDrawerId();
    for (const p of this.playersList()) {
      p.isDrawing = p.id === drawerId;
      p.hasGuessed = false;
    }

    this.broadcast({ type: "draw:clear" });
    const dur = r.settings.roundDurationSec;
    this.setPhaseEnd(dur);

    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.attachmentOf(ws)?.playerId;
      if (!pid) continue;
      const isDrawer = pid === drawerId;
      this.sendRaw(ws, {
        type: "turn:start",
        drawerId: drawerId ?? "",
        round: r.round,
        maskedWord: r.currentMask,
        wordLength: word.length,
        durationSec: dur,
        phaseEndsAt: r.phaseEndsAt ?? Date.now() + dur * 1000,
        word: isDrawer ? word : null,
      });
    }
    this.sendStateToAll();
    void this.updateRegistry();
  }

  private handleChat(fromId: string, text: string): void {
    const r = this.room;
    const player = r.players[fromId];
    if (!player) return;
    const drawerId = this.currentDrawerId();
    const canGuess = r.phase === "drawing" && fromId !== drawerId && !r.correctThisTurn.includes(fromId);

    if (canGuess && r.word) {
      if (isExactGuess(text, r.word)) {
        r.correctThisTurn.push(fromId);
        player.hasGuessed = true;
        const total = r.settings.roundDurationSec * 1000;
        const remaining = r.phaseEndsAt ? r.phaseEndsAt - Date.now() : 0;
        const points = calculateGuesserScore({ timeRemainingMs: remaining, totalTimeMs: total, guessOrder: r.guessOrder });
        r.guessOrder += 1;
        player.score += points;
        r.roundPoints[fromId] = points;
        this.dirty = true;

        this.broadcast({ type: "guess:correct", playerId: fromId, nickname: player.nickname, points });
        this.systemChat(`${player.nickname} guessed the word!`, "correct");
        this.broadcast({ type: "scores:update", scores: this.scoreboard() });

        if (r.correctThisTurn.length >= r.order.length - 1) this.endTurn();
        return;
      }
      if (isCloseGuess(text, r.word)) {
        this.sendTo(fromId, {
          type: "chat",
          message: { id: crypto.randomUUID(), playerId: null, nickname: "", text: `"${text}" is close!`, kind: "close", ts: Date.now() },
        });
      }
    }

    // Never echo the drawer accidentally typing the exact answer.
    if (r.phase === "drawing" && fromId === drawerId && r.word && isExactGuess(text, r.word)) return;

    this.broadcast({
      type: "chat",
      message: { id: crypto.randomUUID(), playerId: fromId, nickname: player.nickname, text, kind: "chat", ts: Date.now() },
    });
  }

  private endTurn(): void {
    this.transition();
    const r = this.room;
    const word = r.word ?? "";
    const drawerId = this.currentDrawerId();
    const drawer = drawerId ? r.players[drawerId] : undefined;
    const totalGuessers = Math.max(0, r.order.length - 1);
    if (drawer) {
      const drawerScore = calculateDrawerScore({ correctGuessers: r.correctThisTurn.length, totalGuessers });
      drawer.score += drawerScore;
      r.roundPoints[drawer.id] = drawerScore;
    }
    r.phase = "reveal";
    this.broadcast({ type: "turn:reveal", word, scores: this.scoreboard() });
    this.sendStateToAll();
    this.setPhaseEnd(GAME.TURN_REVEAL_DURATION_SEC);
    void this.updateRegistry();
  }

  private abortTurnDrawerLeft(): void {
    this.transition();
    const r = this.room;
    r.phase = "reveal";
    this.broadcast({ type: "turn:reveal", word: r.word ?? "", scores: this.scoreboard() });
    this.sendStateToAll();
    this.setPhaseEnd(GAME.TURN_REVEAL_DURATION_SEC);
  }

  private nextTurn(): void {
    const r = this.room;
    const adv = advanceTurn({
      drawerIndex: r.drawerIndex,
      playerCount: r.order.length,
      currentRound: r.round,
      maxRounds: r.settings.maxRounds,
    });
    if (adv.phase === "game-over") {
      this.endGame();
      return;
    }
    r.drawerIndex = adv.drawerIndex;
    r.round = adv.currentRound;
    this.beginChoosing();
  }

  private endGame(): void {
    this.transition();
    const r = this.room;
    r.phase = "game-over";
    r.word = null;
    this.broadcast({ type: "game:over", leaderboard: this.scoreboard() });
    this.sendStateToAll();
    // After a short pause, the room returns to the lobby (alarm-driven).
    this.setPhaseEnd(GAME.ROUND_END_DURATION_SEC);
    void this.updateRegistry();
  }

  private resetToLobby(): void {
    this.transition();
    const r = this.room;
    r.phase = "lobby";
    r.round = 0;
    r.drawerIndex = 0;
    r.roundPoints = {};
    r.word = null;
    r.wordChoices = null;
    r.currentMask = "";
    r.phaseEndsAt = null;
    r.correctThisTurn = [];
    r.guessOrder = 0;
    r.hintsRevealed = 0;
    r.hintMaxCount = 0;
    for (const p of this.playersList()) {
      p.score = 0;
      p.isDrawing = false;
      p.hasGuessed = false;
    }
    this.sendStateToAll();
    void this.updateRegistry();
  }

  /* ------------------------------ Leave / kick ----------------------------- */

  private handleKick(fromId: string, targetId: string): void {
    const r = this.room;
    if (fromId !== r.hostId || targetId === fromId) return;
    const target = this.socketFor(targetId);
    if (!r.players[targetId]) return;
    if (target) this.sendRaw(target, { type: "error", code: "NOT_ALLOWED", message: "you were kicked" });
    this.handleLeave(targetId);
    if (target) this.closeSocket(target, 1000, "kicked");
  }

  private handleLeave(playerId: string): void {
    const r = this.room;
    const idx = r.order.indexOf(playerId);
    if (idx === -1) return;
    this.dirty = true;

    const wasDrawer = playerId === this.currentDrawerId();
    r.order.splice(idx, 1);
    delete r.players[playerId];
    r.correctThisTurn = r.correctThisTurn.filter((id) => id !== playerId);

    if (r.hostId === playerId) {
      r.hostId = r.order[0] ?? null;
      const newHost = r.hostId ? r.players[r.hostId] : undefined;
      if (newHost) {
        newHost.isHost = true;
        this.broadcast({ type: "host:changed", hostId: newHost.id });
      }
    }
    this.broadcast({ type: "player:left", playerId });

    if (r.order.length === 0) {
      this.resetEmptyRoom();
      return;
    }
    if (idx < r.drawerIndex) r.drawerIndex -= 1;

    const active = r.phase === "choosing" || r.phase === "drawing";
    if (active && wasDrawer) {
      r.drawerIndex -= 1; // nextTurn() advances into the freed slot
      this.abortTurnDrawerLeft();
      return;
    }
    if (r.phase !== "lobby" && r.phase !== "game-over" && r.order.length < GAME.MIN_PLAYERS_TO_START) {
      this.endGame();
      return;
    }
    this.sendStateToAll();
    void this.updateRegistry();
  }

  private resetEmptyRoom(): void {
    const { roomId, settings, isPublic } = this.room;
    this.room = freshRoomState(roomId, settings, isPublic);
    this.room.initialized = true;
    this.rearm = true; // lobby + no phaseEndsAt -> armAlarm() clears the alarm
    void this.removeRegistry();
  }

  /* ----------------------------- State helpers ----------------------------- */

  private setPhaseEnd(seconds: number): void {
    this.room.phaseEndsAt = Date.now() + seconds * 1000;
  }

  private transition(): void {
    this.dirty = true;
    this.rearm = true;
  }

  private currentDrawerId(): string | null {
    return this.room.order[this.room.drawerIndex] ?? null;
  }

  private playersList(): Player[] {
    return this.room.order.map((id) => this.room.players[id]).filter((p): p is Player => Boolean(p));
  }

  private scoreboard(): ScoreEntry[] {
    return this.playersList()
      .map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        score: p.score,
        roundPoints: this.room.roundPoints[p.id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private buildState(forId: string): PublicRoomState {
    const r = this.room;
    const isDrawer = forId === this.currentDrawerId();
    return {
      roomId: r.roomId,
      phase: r.phase,
      settings: r.settings,
      players: this.playersList(),
      hostId: r.hostId,
      currentRound: r.round,
      drawerId: this.currentDrawerId(),
      maskedWord: r.phase === "drawing" ? r.currentMask : r.word ? maskWord(r.word) : null,
      wordLength: r.word ? r.word.length : null,
      phaseEndsAt: r.phaseEndsAt,
      // Drawer-only fields — never populated for guessers.
      word: isDrawer ? r.word : null,
      wordChoices: isDrawer && r.phase === "choosing" ? r.wordChoices : null,
    };
  }

  /* --------------------------- Socket / broadcast -------------------------- */

  private attachmentOf(ws: WebSocket): SocketAttachment | null {
    const a = ws.deserializeAttachment() as SocketAttachment | null;
    return a && typeof a === "object" && typeof a.playerId === "string" ? a : null;
  }

  private socketFor(playerId: string): WebSocket | undefined {
    for (const ws of this.ctx.getWebSockets()) {
      if (this.attachmentOf(ws)?.playerId === playerId) return ws;
    }
    return undefined;
  }

  private sendRaw(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(encode(msg));
    } catch {
      /* socket is closing/closed */
    }
  }

  private sendTo(playerId: string, msg: ServerMessage): void {
    const ws = this.socketFor(playerId);
    if (ws) this.sendRaw(ws, msg);
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.attachmentOf(ws)?.playerId;
      if (pid && pid !== exceptId) this.sendRaw(ws, msg);
    }
  }

  private sendError(toId: string, code: ErrorCode, message: string): void {
    this.sendTo(toId, { type: "error", code, message });
  }

  private systemChat(text: string, kind: ChatKind): void {
    this.broadcast({
      type: "chat",
      message: { id: crypto.randomUUID(), playerId: null, nickname: "", text, kind, ts: Date.now() },
    });
  }

  private sendStateToAll(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const pid = this.attachmentOf(ws)?.playerId;
      if (!pid) continue;
      this.sendRaw(ws, { type: "room:state", state: this.buildState(pid), youId: pid });
    }
  }

  private closeSocket(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  /* ------------------------------ Persistence ------------------------------ */

  private async afterMutation(): Promise<void> {
    if (this.rearm) await this.armAlarm();
    if (this.dirty || this.rearm) await this.save();
  }

  private async save(): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, this.room);
  }

  /* ----------------------------- Lobby registry ---------------------------- */

  private async updateRegistry(): Promise<void> {
    const r = this.room;
    if (!r.roomId) return;
    try {
      const hostNickname = r.hostId ? (r.players[r.hostId]?.nickname ?? null) : null;
      await upsertLobbyRoom(this.env.DB, {
        roomId: r.roomId,
        name: hostNickname ? `${hostNickname}'s room` : "Open room",
        isPublic: r.isPublic,
        phase: r.phase,
        playerCount: r.order.length,
        maxPlayers: r.settings.maxPlayers,
        maxRounds: r.settings.maxRounds,
        roundDurationSec: r.settings.roundDurationSec,
        hostNickname,
      });
      await invalidatePublicLobby(this.env);
    } catch {
      /* registry is best-effort and must never break gameplay */
    }
  }

  private async removeRegistry(): Promise<void> {
    if (!this.room.roomId) return;
    try {
      await deleteLobbyRoom(this.env.DB, this.room.roomId);
      await invalidatePublicLobby(this.env);
    } catch {
      /* best-effort */
    }
  }
}
