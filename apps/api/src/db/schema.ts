import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Word packs available to rooms. The three bundled packs from `@skribbl/shared`
 * are seeded here (is_custom = 0); host-created packs are inserted with
 * is_custom = 1 and merged into a room's word pool at game start.
 */
export const wordPacks = sqliteTable("word_packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** JSON-encoded string[] of words. */
  words: text("words", { mode: "json" }).$type<string[]>().notNull(),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

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
export type LobbyRoomRow = typeof lobbyRooms.$inferSelect;
