import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  DEFAULT_ROOM_ID_LEN,
  defaultRoomSettings,
  generateRoomId,
  roomIdSchema,
  roomSettingsSchema,
  type RoomSettings,
} from "@skribbl/shared";
import type { Env } from "./env";
import { checkRateLimit } from "./lib/rate-limit";
import { getRoomMeta, readPublicLobby, roomInitKey, seedLobbyRoom, type RoomInit } from "./lib/lobby";
import { getLobbyRoom } from "./db/queries";
import { createWordPack, getWordPack, listAllWordPacks, validateWordPack, MAX_PACK_DESCRIPTION_LEN, MAX_PACK_NAME_LEN } from "./lib/words";

export { GameRoom } from "./durable/GameRoom";

/** Cryptographically strong [0, 1) source for room-code generation. */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

const app = new Hono<{ Bindings: Env }>();

// Anonymous game, no cookies/credentials — permissive CORS for the Expo client
// (native + web). WebSocket upgrades are not subject to CORS.
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true }));

/** Create a room. Body: partial RoomSettings + optional name. Returns { roomId }. */
app.post("/api/rooms", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "anonymous";
  const allowed = await checkRateLimit(c.env.KV, ip, { limit: 15, windowSec: 60, prefix: "rl:create" });
  if (!allowed) return c.json({ error: "RATE_LIMITED", message: "too many rooms created — slow down" }, 429);

  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const parsed = roomSettingsSchema.partial().safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: "INVALID_MESSAGE", message: parsed.error.message }, 400);
  }

  const settings: RoomSettings = { ...defaultRoomSettings, ...parsed.data };
  if (!settings.wordPackIds || settings.wordPackIds.length === 0) settings.wordPackIds = ["default"];

  const roomName = extractRoomName(body);
  const roomId = await generateUniqueRoomId(c.env);
  const init: RoomInit = { name: roomName, settings, isPublic: settings.isPublic };
  try {
    await c.env.KV.put(roomInitKey(roomId), JSON.stringify(init), { expirationTtl: 60 * 60 * 6 });
  } catch {
    /* DO falls back to defaults if init is missing */
  }
  await seedLobbyRoom(c.env, roomId, settings, roomName);

  return c.json({ roomId, settings });
});

/** Browse public, joinable rooms. Query: ?status=open|joinable&page=1&limit=20 */
app.get("/api/rooms", async (c) => {
  const query = c.req.query();
  const status = query.status ?? "joinable";
  const page = parseInt(query.page ?? "1", 10);
  const limit = Math.min(parseInt(query.limit ?? "20", 10), 50);
  const joinable = status !== "all";

  const all = await readPublicLobby(c.env);
  // The cached list is already public+lobby+non-empty. Re-apply joinable filter here so
  // full rooms are excluded when status=joinable/open, and included for status=all.
  const filtered = joinable ? all.filter((r) => r.playerCount < r.maxPlayers) : all;
  const total = filtered.length;
  const offset = Math.max(0, (page - 1) * limit);
  const rooms = filtered.slice(offset, offset + limit);

  return c.json({ rooms, page, limit, total });
});

/** Existence + metadata for a single room. */
app.get("/api/rooms/:id", async (c) => {
  const id = c.req.param("id").toUpperCase();
  const meta = await getRoomMeta(c.env, id);
  if (!meta) return c.json({ exists: false }, 404);
  return c.json({ exists: true, room: meta });
});

/** Available word packs (bundled + D1 custom). */
app.get("/api/words", async (c) => {
  const packs = await listAllWordPacks(c.env);
  return c.json({ packs });
});

/** Create a custom word pack. */
app.post("/api/word-packs", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "anonymous";
  const allowed = await checkRateLimit(c.env.KV, ip, { limit: 10, windowSec: 60, prefix: "rl:pack" });
  if (!allowed) return c.json({ error: "RATE_LIMITED", message: "too many packs created — slow down" }, 429);

  let body: Record<string, unknown> = {};
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const isPublic = body.isPublic !== false;
  const createdBy = typeof body.createdBy === "string" ? body.createdBy.trim() || null : null;

  const validationErrors: string[] = [];
  if (name.length === 0) validationErrors.push("Pack name is required.");
  if (name.length > MAX_PACK_NAME_LEN) validationErrors.push(`Pack name must be ${MAX_PACK_NAME_LEN} characters or fewer.`);
  if (description.length > MAX_PACK_DESCRIPTION_LEN) {
    validationErrors.push(`Description must be ${MAX_PACK_DESCRIPTION_LEN} characters or fewer.`);
  }

  const wordsValidation = validateWordPack(body.words, name);
  if (!wordsValidation.ok) validationErrors.push(...wordsValidation.errors);

  if (validationErrors.length > 0 || !wordsValidation.ok) {
    return c.json({ error: "INVALID_MESSAGE", message: validationErrors.join(" ") }, 400);
  }

  try {
    const pack = await createWordPack(c.env, {
      name,
      description,
      isPublic,
      createdBy,
      words: wordsValidation.words,
    });
    return c.json({ pack }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "could not create word pack";
    return c.json({ error: "INTERNAL_ERROR", message }, 500);
  }
});

/** Fetch a specific word pack (bundled or D1). */
app.get("/api/word-packs/:id", async (c) => {
  const id = c.req.param("id");
  const pack = await getWordPack(c.env, id);
  if (!pack) return c.json({ error: "WORD_PACK_NOT_FOUND" }, 404);
  return c.json({ pack });
});

/** WebSocket upgrade → the room's Durable Object. */
app.get("/api/rooms/:id/ws", async (c) => {
  if ((c.req.header("Upgrade") ?? "").toLowerCase() !== "websocket") {
    return c.text("expected a WebSocket upgrade", 426);
  }
  const id = c.req.param("id").toUpperCase();
  if (!roomIdSchema.safeParse(id).success) return c.text("invalid room id", 400);

  const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(id));
  // Forward the upgrade, telling the DO which room code it represents.
  const headers = new Headers(c.req.raw.headers);
  headers.set("X-Room-Id", id);
  return stub.fetch(new Request(c.req.raw.url, { method: "GET", headers }));
});

app.notFound((c) => c.json({ error: "ROOM_NOT_FOUND", message: "not found" }, 404));

function extractRoomName(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const maybe = (body as { name?: unknown }).name;
  if (typeof maybe !== "string") return undefined;
  const trimmed = maybe.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function generateUniqueRoomId(env: Env): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateRoomId(DEFAULT_ROOM_ID_LEN, secureRandom);
    try {
      const existing = await getLobbyRoom(env.DB, candidate);
      if (!existing) return candidate;
    } catch {
      return candidate; // D1 unavailable — accept the (very likely unique) code
    }
  }
  return generateRoomId(DEFAULT_ROOM_ID_LEN, secureRandom);
}

export default app;
