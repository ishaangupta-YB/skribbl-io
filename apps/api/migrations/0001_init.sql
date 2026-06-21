-- 0001_init.sql — schema + seeded default word packs (Agent A)
-- Word-pack seed rows are generated from @skribbl/shared WORD_PACKS.

CREATE TABLE IF NOT EXISTS word_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  words TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS lobby_rooms (
  room_id TEXT PRIMARY KEY,
  is_public INTEGER NOT NULL DEFAULT 0,
  phase TEXT NOT NULL DEFAULT 'lobby',
  player_count INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL DEFAULT 8,
  max_rounds INTEGER NOT NULL DEFAULT 3,
  round_duration_sec INTEGER NOT NULL DEFAULT 70,
  host_nickname TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_lobby_public ON lobby_rooms (is_public, phase, updated_at);

-- Seed bundled packs (is_custom = 0). Idempotent via INSERT OR IGNORE.
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('default', 'Classic', 'Everyday objects and easy-to-draw things.', '["apple","house","car","tree","boat","phone","guitar","pizza","robot","rocket","umbrella","clock","ladder","bridge","castle","balloon","camera","candle","anchor","key","crown","diamond","hammer","scissors","bicycle","train","airplane","lighthouse","snowman","rainbow","mountain","island","volcano","cactus","flower","mushroom","butterfly","ladybug","spider","starfish","envelope","glasses","backpack","telescope","microphone","trophy","compass","hourglass","skateboard","surfboard","kite","drum","violin","trumpet","piano","wheel","magnet","battery","lightbulb","toothbrush","sandwich","cupcake","donut","popcorn","ice cream","pencil","paintbrush","eraser","stapler","calculator","map"]', 0);
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('animals', 'Animals', 'Creatures great and small.', '["cat","dog","elephant","giraffe","lion","tiger","bear","rabbit","kangaroo","penguin","dolphin","whale","shark","octopus","crab","snail","turtle","frog","snake","owl","eagle","parrot","peacock","flamingo","ostrich","horse","zebra","cow","pig","sheep","goat","chicken","duck","fox","wolf","deer","squirrel","hedgehog","koala","panda","monkey","gorilla","camel","rhino","hippo","crocodile","butterfly","bee","ant","ladybug"]', 0);
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('food', 'Food & Drink', 'Tasty things to sketch.', '["pizza","burger","hotdog","taco","sushi","noodles","spaghetti","pancake","waffle","croissant","bagel","pretzel","sandwich","salad","soup","steak","bacon","egg","cheese","bread","carrot","broccoli","corn","tomato","potato","onion","pepper","banana","apple","orange","grapes","strawberry","watermelon","pineapple","cherry","lemon","peach","coconut","avocado","icecream","cupcake","donut","cookie","cake","lollipop","chocolate","popcorn","coffee","milkshake","juice"]', 0);
