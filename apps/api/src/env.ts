/**
 * Worker/Durable Object bindings, mirrored in `wrangler.toml`.
 *
 * `DurableObjectNamespace` is intentionally left unparameterized to avoid a
 * type import cycle with the `GameRoom` class (which imports this `Env`).
 */
export interface Env {
  /** One Durable Object per room: `idFromName(roomId)`. */
  GAME_ROOM: DurableObjectNamespace;
  /** Word packs + public lobby registry. */
  DB: D1Database;
  /** Cached lobby list + per-IP rate limiting + room init settings. */
  KV: KVNamespace;
}
