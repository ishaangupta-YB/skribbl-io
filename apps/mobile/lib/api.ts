/**
 * Thin REST client for the Cloudflare Worker backend (`apps/api`).
 *
 * All helpers derive the HTTP base from {@link HTTP_BASE_URL} (which itself is
 * derived from `EXPO_PUBLIC_WS_URL`), so the client never hardcodes a host.
 * Errors are normalized into a single {@link ApiError} shape so callers can
 * surface a friendly toast without inspecting fetch internals.
 */
import type { RoomSettings } from "@skribbl/shared";
import { HTTP_BASE_URL } from "./config";

export interface CreateRoomResponse {
  roomId: string;
  settings: RoomSettings;
}

/** Public-facing room metadata returned by `GET /api/rooms/:id` and `/api/rooms`. */
export interface RoomMeta {
  roomId: string;
  isPublic: boolean;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  maxRounds: number;
  roundDurationSec: number;
  hostNickname: string | null;
}

export interface GetRoomResponse {
  exists: boolean;
  room?: RoomMeta;
}

export interface WordPackSummary {
  id: string;
  name: string;
  description: string;
  words: string[];
}

export interface GetWordsResponse {
  packs: WordPackSummary[];
}

export interface CreateWordPackInput {
  name: string;
  description?: string;
  words: string | string[];
  isPublic?: boolean;
  createdBy?: string;
}

export interface WordPackDetail extends WordPackSummary {
  isPublic: boolean;
  createdBy: string | null;
  createdAt?: number;
}

export interface CreateWordPackResponse {
  pack: WordPackDetail;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  const code = body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
    ? (body as { error: string }).error
    : null;
  const message = body && typeof body === "object" && "message" in body && typeof (body as { message: unknown }).message === "string"
    ? (body as { message: string }).message
    : `request failed (${res.status})`;
  return new ApiError(message, res.status, code);
}

/** Create a room with the given (partial) settings. Returns the authoritative room code. */
export async function createRoom(settings: Partial<RoomSettings>): Promise<CreateRoomResponse> {
  const res = await fetch(`${HTTP_BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CreateRoomResponse;
}

/** Check whether a room exists (and fetch its metadata). 404 → `{ exists:false }`. */
export async function getRoom(roomId: string): Promise<GetRoomResponse> {
  const res = await fetch(`${HTTP_BASE_URL}/api/rooms/${encodeURIComponent(roomId.toUpperCase())}`);
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GetRoomResponse;
}

/** List public, joinable rooms (best-effort; eventually consistent). */
export async function listPublicRooms(): Promise<RoomMeta[]> {
  const res = await fetch(`${HTTP_BASE_URL}/api/rooms`);
  if (!res.ok) throw await parseError(res);
  const body = (await res.json()) as { rooms: RoomMeta[] };
  return body.rooms ?? [];
}

/** Available word packs (bundled + D1 custom). */
export async function listWordPacks(): Promise<GetWordsResponse> {
  const res = await fetch(`${HTTP_BASE_URL}/api/words`);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as GetWordsResponse;
}

/** Create a custom word pack. */
export async function createWordPack(input: CreateWordPackInput): Promise<CreateWordPackResponse> {
  const res = await fetch(`${HTTP_BASE_URL}/api/word-packs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as CreateWordPackResponse;
}
