/**
 * A tiny, fully-typed event emitter used by {@link RoomConnection}.
 *
 * Kept dependency-free (no Node `events`, no DOM `EventTarget`) so the realtime
 * core runs identically in Metro (iOS/Android), the browser, and Node/Vitest.
 */
export type Listener<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    // Snapshot so a listener can safely unsubscribe while we iterate.
    for (const listener of [...set]) {
      (listener as Listener<Events[K]>)(payload);
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
