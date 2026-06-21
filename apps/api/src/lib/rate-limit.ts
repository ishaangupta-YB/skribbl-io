/**
 * Best-effort per-IP rate limiting backed by KV. KV is eventually consistent
 * and not strictly atomic, so this is a coarse abuse guard (e.g. for room
 * creation), not a security boundary. Fails open if KV is unavailable.
 */
export interface RateLimitOptions {
  limit: number;
  windowSec: number;
  prefix: string;
}

const DEFAULTS: RateLimitOptions = { limit: 10, windowSec: 60, prefix: "rl:create" };

export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  options: Partial<RateLimitOptions> = {},
): Promise<boolean> {
  const { limit, windowSec, prefix } = { ...DEFAULTS, ...options };
  const key = `${prefix}:${identifier}`;
  try {
    const current = await kv.get(key);
    const count = current ? Number.parseInt(current, 10) || 0 : 0;
    if (count >= limit) return false;
    await kv.put(key, String(count + 1), { expirationTtl: Math.max(60, windowSec) });
    return true;
  } catch {
    return true;
  }
}
