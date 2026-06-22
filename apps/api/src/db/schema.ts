import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Host-created and bundled word packs. Bundled packs from `@skribbl/shared` are
 * seeded with `isPublic = false` and `createdBy = null`; custom packs created
 * via `POST /api/word-packs` are public and tagged with the creator's nickname.
 */
export const wordPacks = sqliteTable("word_packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Normalized words table. Each row is one word belonging to a pack. The
 * composite primary key prevents duplicate words within a pack.
 */
export const words = sqliteTable(
  "words",
  {
    packId: text("pack_id").notNull(),
    word: text("word").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.packId, table.word] }),
    packIdx: index("idx_words_pack_id").on(table.packId),
  }),
);

/**
 * Lightweight registry of live rooms, kept up to date by each GameRoom DO.
 * Powers `GET /api/rooms` (public lobby browser) and `GET /api/rooms/:id`.
 */
export const lobbyRooms = sqliteTable(
  "lobby_rooms",
  {
    roomId: text("room_id").primaryKey(),
    name: text("name").notNull().default(""),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    phase: text("phase").notNull().default("lobby"),
    playerCount: integer("player_count").notNull().default(0),
    maxPlayers: integer("max_players").notNull().default(8),
    maxRounds: integer("max_rounds").notNull().default(3),
    roundDurationSec: integer("round_duration_sec").notNull().default(70),
    hostNickname: text("host_nickname"),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    publicIdx: index("idx_lobby_public").on(table.isPublic, table.phase, table.updatedAt),
  }),
);

export type WordPackRow = typeof wordPacks.$inferSelect;
export type WordRow = typeof words.$inferSelect;
export type LobbyRoomRow = typeof lobbyRooms.$inferSelect;
