-- 0003_word_packs_split.sql — normalize word packs into word_packs + words
--
-- Depends on 0001_init.sql (creates the legacy `word_packs` table) and
-- 0002_add_room_name.sql. Moves the JSON `words` column into a dedicated
-- `words` table, adds `is_public` / `created_by` for host-created custom packs,
-- and re-seeds the bundled packs from `@skribbl/shared` so the default pack
-- remains available even when D1 is empty.

-- 1. New normalized word_packs table.
CREATE TABLE IF NOT EXISTS word_packs_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- 2. Dedicated words table (composite PK prevents duplicate words within a pack).
CREATE TABLE IF NOT EXISTS words (
  pack_id TEXT NOT NULL,
  word TEXT NOT NULL,
  PRIMARY KEY (pack_id, word)
);

CREATE INDEX IF NOT EXISTS idx_words_pack_id ON words (pack_id);

-- 3. Migrate existing word packs from the old JSON layout.
INSERT OR IGNORE INTO word_packs_new (id, name, description, is_public, created_by, created_at)
SELECT id, name, description, 0, NULL, created_at FROM word_packs;

-- 4. Migrate words from the old JSON column into the normalized table.
INSERT OR IGNORE INTO words (pack_id, word)
SELECT word_packs.id, value FROM word_packs, json_each(word_packs.words) WHERE word_packs.words IS NOT NULL;

-- 5. Swap the old table for the new one.
DROP TABLE word_packs;
ALTER TABLE word_packs_new RENAME TO word_packs;

-- 6. Re-seed bundled packs (idempotent) so a fresh/empty D1 always has them.
INSERT OR IGNORE INTO word_packs (id, name, description, is_public, created_by) VALUES
  ('default', 'Classic', 'Everyday objects and easy-to-draw things.', 0, NULL),
  ('animals', 'Animals', 'Creatures great and small.', 0, NULL),
  ('food', 'Food & Drink', 'Tasty things to sketch.', 0, NULL);
