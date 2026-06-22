/** Parse a user-pasted word list into normalized, filtered words. */
export function parseCustomWords(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0 && w.length <= 30);
}

/** Format a list of words for display in a textarea. */
export function formatCustomWords(words: string[]): string {
  return words.join("\n");
}
