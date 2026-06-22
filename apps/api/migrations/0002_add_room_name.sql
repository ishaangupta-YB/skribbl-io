-- 0002_add_room_name.sql — add a human-readable room name to the lobby registry.
-- The name is populated by the GameRoom DO from the host nickname, and is shown
-- in the public lobby browser.

ALTER TABLE lobby_rooms ADD COLUMN name TEXT NOT NULL DEFAULT '';
