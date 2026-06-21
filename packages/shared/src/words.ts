import { shuffle } from "./utils";

export interface WordPack {
  id: string;
  name: string;
  description: string;
  words: string[];
}

/**
 * Bundled default word packs. These are *drawable nouns* — an intentional
 * upgrade over the legacy `getWord.js`, which returned ~1100 abstract
 * adjectives ("aback", "abhorrent") that are nearly impossible to draw.
 *
 * Additional/custom packs live in Cloudflare D1 and are merged at runtime by
 * the backend; this bundle guarantees the game works even with an empty DB.
 */
export const WORD_PACKS: Record<string, WordPack> = {
  default: {
    id: "default",
    name: "Classic",
    description: "Everyday objects and easy-to-draw things.",
    words: [
      "apple", "house", "car", "tree", "boat", "phone", "guitar", "pizza",
      "robot", "rocket", "umbrella", "clock", "ladder", "bridge", "castle",
      "balloon", "camera", "candle", "anchor", "key", "crown", "diamond",
      "hammer", "scissors", "bicycle", "train", "airplane", "lighthouse",
      "snowman", "rainbow", "mountain", "island", "volcano", "cactus",
      "flower", "mushroom", "butterfly", "ladybug", "spider", "starfish",
      "envelope", "glasses", "backpack", "telescope", "microphone", "trophy",
      "compass", "hourglass", "skateboard", "surfboard", "kite", "drum",
      "violin", "trumpet", "piano", "wheel", "magnet", "battery", "lightbulb",
      "toothbrush", "sandwich", "cupcake", "donut", "popcorn", "ice cream",
      "pencil", "paintbrush", "eraser", "stapler", "calculator", "map",
    ],
  },
  animals: {
    id: "animals",
    name: "Animals",
    description: "Creatures great and small.",
    words: [
      "cat", "dog", "elephant", "giraffe", "lion", "tiger", "bear", "rabbit",
      "kangaroo", "penguin", "dolphin", "whale", "shark", "octopus", "crab",
      "snail", "turtle", "frog", "snake", "owl", "eagle", "parrot", "peacock",
      "flamingo", "ostrich", "horse", "zebra", "cow", "pig", "sheep", "goat",
      "chicken", "duck", "fox", "wolf", "deer", "squirrel", "hedgehog",
      "koala", "panda", "monkey", "gorilla", "camel", "rhino", "hippo",
      "crocodile", "butterfly", "bee", "ant", "ladybug",
    ],
  },
  food: {
    id: "food",
    name: "Food & Drink",
    description: "Tasty things to sketch.",
    words: [
      "pizza", "burger", "hotdog", "taco", "sushi", "noodles", "spaghetti",
      "pancake", "waffle", "croissant", "bagel", "pretzel", "sandwich",
      "salad", "soup", "steak", "bacon", "egg", "cheese", "bread",
      "carrot", "broccoli", "corn", "tomato", "potato", "onion", "pepper",
      "banana", "apple", "orange", "grapes", "strawberry", "watermelon",
      "pineapple", "cherry", "lemon", "peach", "coconut", "avocado",
      "icecream", "cupcake", "donut", "cookie", "cake", "lollipop",
      "chocolate", "popcorn", "coffee", "milkshake", "juice",
    ],
  },
};

export const DEFAULT_WORD_PACK_IDS = ["default"];

export function getWordPack(id: string): WordPack | undefined {
  return WORD_PACKS[id];
}

export function listWordPacks(): WordPack[] {
  return Object.values(WORD_PACKS);
}

/** Merge the chosen packs plus any custom words into a unique, lowercased pool. */
export function collectWords(packIds: string[], customWords: string[] = []): string[] {
  const set = new Set<string>();
  for (const id of packIds) {
    const pack = WORD_PACKS[id];
    if (pack) {
      for (const w of pack.words) set.add(w.toLowerCase());
    }
  }
  for (const w of customWords) {
    const t = w.trim().toLowerCase();
    if (t) set.add(t);
  }
  return [...set];
}

/**
 * Pick `count` distinct random words from `pool`, avoiding any in `exclude`
 * (words already used this game). Falls back to the full pool if exclusions
 * would leave too few choices. `random` is injectable for deterministic tests.
 */
export function getRandomWords(
  pool: string[],
  count: number,
  exclude: Iterable<string> = [],
  random: () => number = Math.random,
): string[] {
  const excludeSet = new Set([...exclude].map((w) => w.toLowerCase()));
  const candidates = pool.filter((w) => !excludeSet.has(w.toLowerCase()));
  const source = candidates.length >= count ? candidates : pool;
  return shuffle(source, random).slice(0, Math.min(count, source.length));
}
