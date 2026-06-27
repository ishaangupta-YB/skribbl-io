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
  max_players INTEGER NOT NULL DEFAULT 20,
  max_rounds INTEGER NOT NULL DEFAULT 3,
  round_duration_sec INTEGER NOT NULL DEFAULT 70,
  host_nickname TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_lobby_public ON lobby_rooms (is_public, phase, updated_at);

-- Seed bundled packs (is_custom = 0). Idempotent via INSERT OR IGNORE.
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('default', 'Classic', 'Everyday objects, people, places, and easy-to-draw things.', '["apple","house","car","tree","boat","phone","guitar","pizza","robot","rocket","umbrella","clock","ladder","bridge","castle","balloon","camera","candle","anchor","key","crown","diamond","hammer","scissors","bicycle","train","airplane","lighthouse","snowman","rainbow","mountain","island","volcano","cactus","flower","mushroom","butterfly","ladybug","spider","starfish","envelope","glasses","backpack","telescope","microphone","trophy","compass","hourglass","skateboard","surfboard","kite","drum","violin","trumpet","piano","wheel","magnet","battery","lightbulb","toothbrush","sandwich","cupcake","donut","popcorn","ice cream","pencil","paintbrush","eraser","stapler","calculator","map","mailbox","flashlight","binoculars","suitcase","helmet","shield","sword","wizard","witch","pirate","ninja","astronaut","chef","clown","knight","dinosaur","dragon","unicorn","mermaid","alien","ghost","vampire","zombie","monster","cyborg","ufo","satellite","planet","moon","sun","cloud","star","rain","snow","tornado","desert","jungle","forest","ocean","river","waterfall","beach","cave","canyon","farm","barn","windmill","skyscraper","factory","hospital","school","library","museum","stadium","airport","train station","tunnel","dam","temple","church","pyramid","statue","fountain","garden","park","zoo","circus","carnival","roller coaster","ferris wheel","carousel","bakery","bookstore","bank","police station","fire station","post office"]', 0);
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('animals', 'Animals', 'Creatures great and small.', '["cat","dog","elephant","giraffe","lion","tiger","bear","rabbit","kangaroo","penguin","dolphin","whale","shark","octopus","crab","snail","turtle","frog","snake","owl","eagle","parrot","peacock","flamingo","ostrich","horse","zebra","cow","pig","sheep","goat","chicken","duck","fox","wolf","deer","squirrel","hedgehog","koala","panda","monkey","gorilla","camel","rhino","hippo","crocodile","butterfly","bee","ant","ladybug","platypus","armadillo","porcupine","raccoon","beaver","otter","seal","walrus","moose","buffalo","bison","antelope","gazelle","cheetah","leopard","jaguar","panther","lynx","meerkat","lemur","sloth","anteater","aardvark","wombat","tasmanian devil","chameleon","iguana","gecko","salamander","newt","tarantula","scorpion","centipede","millipede","jellyfish","seahorse","lobster","shrimp","oyster","clam","squid","cuttlefish","manatee","narwhal","beluga","orca","hamster","gerbil","chinchilla","ferret"]', 0);
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('food', 'Food & Drink', 'Tasty things to sketch.', '["pizza","burger","hotdog","taco","sushi","noodles","spaghetti","pancake","waffle","croissant","bagel","pretzel","sandwich","salad","soup","steak","bacon","egg","cheese","bread","carrot","broccoli","corn","tomato","potato","onion","pepper","banana","apple","orange","grapes","strawberry","watermelon","pineapple","cherry","lemon","peach","coconut","avocado","icecream","cupcake","donut","cookie","cake","lollipop","chocolate","popcorn","coffee","milkshake","juice","burrito","enchilada","quesadilla","nachos","falafel","hummus","kebab","curry","ramen","pho","dumpling","spring roll","dim sum","pad thai","bibimbap","lasagna","macaroni","ravioli","fettuccine","risotto","paella","moussaka","shawarma","pita","naan","roti","baguette","sourdough","muffin","scone","biscuit","brownie","cheesecake","tiramisu","macaron","eclair","profiterole","pudding","smoothie","latte","cappuccino","espresso","tea","lemonade","mojito","margarita","martini","sangria","milk"]', 0);
INSERT OR IGNORE INTO word_packs (id, name, description, words, is_custom) VALUES ('hard', 'Extreme', 'Very tough concepts and things that are extremely hard to draw.', '["democracy","gravity","entropy","inflation","nostalgia","schadenfreude","deja vu","metaphor","irony","paradox","serendipity","epiphany","consciousness","subconscious","dream","nightmare","memory","time","eternity","infinity","silence","echo","shadow","reflection","refraction","magnetism","electricity","voltage","circuit","algorithm","database","encryption","bandwidth","latency","packet","firewall","virus","bacteria","antibody","photosynthesis","mitochondria","neuron","black hole","supernova","nebula","quasar","constellation","eclipse","solstice","equinox","tsunami","avalanche","earthquake","landslide","hurricane","tornado","drought","famine","pandemic","evolution","revolution","renaissance","enlightenment","industrialization","globalization","bureaucracy","diplomacy","propaganda","censorship","sanction","tariff","recession","depression","bankruptcy","copyright","patent","trademark","liability","mortgage","dividend","portfolio","cryptocurrency","blockchain","artificial intelligence","machine learning","virtual reality","augmented reality","quantum computing","nanotechnology","biotechnology","gene editing","cloning","space station","satellite","rover","telescope","microscope","particle accelerator"]', 0);
