import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { join } from "./harness";

const BASE = "https://test.local";

describe("REST API", () => {
  it("GET /health returns ok", async () => {
    const resp = await SELF.fetch(`${BASE}/health`);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toMatchObject({ ok: true });
  });

  it("GET /api/words returns the bundled packs (seeded into D1)", async () => {
    const resp = await SELF.fetch(`${BASE}/api/words`);
    expect(resp.status).toBe(200);
    const { packs } = (await resp.json()) as { packs: { id: string; words: string[] }[] };
    const ids = packs.map((p) => p.id);
    expect(ids).toContain("default");
    expect(ids).toContain("animals");
    expect(ids).toContain("food");
    const def = packs.find((p) => p.id === "default");
    expect((def?.words.length ?? 0)).toBeGreaterThan(10);
  });

  it("POST /api/rooms creates a room and validates settings", async () => {
    const resp = await SELF.fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxRounds: 5, isPublic: true }),
    });
    expect(resp.status).toBe(200);
    const json = (await resp.json()) as { roomId: string; settings: { maxRounds: number } };
    expect(json.roomId).toMatch(/^[A-Z0-9]{4,12}$/);
    expect(json.settings.maxRounds).toBe(5);

    // Existence check resolves via the registry/creation metadata.
    const meta = await SELF.fetch(`${BASE}/api/rooms/${json.roomId}`);
    expect(meta.status).toBe(200);
    expect(await meta.json()).toMatchObject({ exists: true });
  });

  it("POST /api/rooms rejects invalid settings", async () => {
    const resp = await SELF.fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxRounds: 999 }),
    });
    expect(resp.status).toBe(400);
  });

  it("GET /api/rooms/:id returns 404 for unknown rooms", async () => {
    const resp = await SELF.fetch(`${BASE}/api/rooms/NOPE99`);
    expect(resp.status).toBe(404);
    expect(await resp.json()).toMatchObject({ exists: false });
  });

  it("lists a public room in the lobby once a player has joined", async () => {
    const create = await SELF.fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isPublic: true }),
    });
    const { roomId } = (await create.json()) as { roomId: string };
    const a = await join(roomId, "Alice");

    // The DO updates the registry asynchronously — poll briefly.
    let listed = false;
    for (let attempt = 0; attempt < 20 && !listed; attempt += 1) {
      const resp = await SELF.fetch(`${BASE}/api/rooms`);
      const { rooms } = (await resp.json()) as { rooms: { roomId: string }[] };
      listed = rooms.some((r) => r.roomId === roomId);
      if (!listed) await new Promise((r) => setTimeout(r, 25));
    }
    expect(listed).toBe(true);
    a.client.close();
  });

  it("rejects WebSocket route without an Upgrade header", async () => {
    const resp = await SELF.fetch(`${BASE}/api/rooms/ABCD/ws`);
    expect(resp.status).toBe(426);
  });

  describe("word packs", () => {
    it("POST /api/word-packs creates a custom pack and GET /api/words lists it", async () => {
      const create = await SELF.fetch(`${BASE}/api/word-packs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "My Pack",
          description: "A test pack",
          words: ["robot", "dragon", "taco"],
          createdBy: "Tester",
        }),
      });
      expect(create.status).toBe(201);
      const { pack } = (await create.json()) as { pack: { id: string; words: string[] } };
      expect(pack.words).toContain("robot");
      expect(pack.words).toContain("dragon");
      expect(pack.words).toContain("taco");

      const list = await SELF.fetch(`${BASE}/api/words`);
      expect(list.status).toBe(200);
      const { packs } = (await list.json()) as { packs: { id: string }[] };
      expect(packs.some((p) => p.id === pack.id)).toBe(true);
    });

    it("POST /api/word-packs rejects invalid input", async () => {
      const resp = await SELF.fetch(`${BASE}/api/word-packs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "", words: [] }),
      });
      expect(resp.status).toBe(400);
      const body = (await resp.json()) as { error: string };
      expect(body.error).toBe("INVALID_MESSAGE");
    });

    it("POST /api/word-packs rejects profanity and oversized words", async () => {
      const resp = await SELF.fetch(`${BASE}/api/word-packs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Bad Pack",
          words: ["fuck", "a".repeat(31)],
        }),
      });
      expect(resp.status).toBe(400);
      const body = (await resp.json()) as { error: string };
      expect(body.error).toBe("INVALID_MESSAGE");
    });

    it("GET /api/word-packs/:id returns a created pack", async () => {
      const create = await SELF.fetch(`${BASE}/api/word-packs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Fetchable Pack",
          words: ["unicorn", "rainbow"],
        }),
      });
      const { pack } = (await create.json()) as { pack: { id: string } };

      const resp = await SELF.fetch(`${BASE}/api/word-packs/${pack.id}`);
      expect(resp.status).toBe(200);
      const body = (await resp.json()) as { pack: { words: string[] } };
      expect(body.pack.words).toContain("unicorn");
      expect(body.pack.words).toContain("rainbow");
    });

    it("GET /api/word-packs/:id returns 404 for unknown packs", async () => {
      const resp = await SELF.fetch(`${BASE}/api/word-packs/unknown-pack-id`);
      expect(resp.status).toBe(404);
    });
  });
});
