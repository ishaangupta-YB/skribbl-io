import { GAME, type Point, type Stroke } from "@skribbl/shared";

export type DrawMode = "draw" | "erase";

export interface StrokeStyle {
  color: string;
  width: number;
  mode: DrawMode;
}

export interface StrokeBatcherOptions extends StrokeStyle {
  /** Emit cadence; ~33ms ≈ 30fps (contract suggests 30–60fps). */
  emitIntervalMs?: number;
  /** Hard cap per frame from the contract (`GAME.MAX_STROKE_POINTS`). */
  maxPointsPerFrame?: number;
  onFlush: (stroke: Stroke) => void;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

const DEFAULT_EMIT_INTERVAL_MS = 1000 / 30;

/**
 * Coalesces a live drawing gesture into throttled `draw` frames.
 *
 * Each flush emits a polyline {@link Stroke}. Consecutive flushes of the same
 * gesture share their boundary point (the previous flush's last point is
 * prepended to the next), so the receiver can stitch the segments back into one
 * continuous stroke (see `applyDraw` in the realtime store). The very first
 * flush of a gesture has no bridge point, which is how the receiver detects the
 * start of a NEW stroke.
 */
export class StrokeBatcher {
  private readonly style: StrokeStyle;
  private readonly emitIntervalMs: number;
  private readonly maxPointsPerFrame: number;
  private readonly onFlush: (stroke: Stroke) => void;
  private readonly now: () => number;

  private pending: Point[] = [];
  private lastEmitted: Point | null = null;
  private lastFlushAt = 0;
  private active = false;

  constructor(options: StrokeBatcherOptions) {
    this.style = { color: options.color, width: options.width, mode: options.mode };
    this.emitIntervalMs = options.emitIntervalMs ?? DEFAULT_EMIT_INTERVAL_MS;
    this.maxPointsPerFrame = Math.max(2, options.maxPointsPerFrame ?? GAME.MAX_STROKE_POINTS);
    this.onFlush = options.onFlush;
    this.now = options.now ?? Date.now;
  }

  /** Begin a new gesture: clears the bridge so the next flush starts a stroke. */
  begin(first?: Point): void {
    this.pending = [];
    this.lastEmitted = null;
    this.lastFlushAt = this.now();
    this.active = true;
    if (first) this.addPoint(first);
  }

  /** Add a point; flushes automatically once the emit interval has elapsed. */
  addPoint(point: Point): void {
    if (!this.active) return;
    const prev = this.pending[this.pending.length - 1] ?? this.lastEmitted;
    if (prev && prev.x === point.x && prev.y === point.y) return; // de-dupe
    this.pending.push(point);
    if (this.now() - this.lastFlushAt >= this.emitIntervalMs) this.flush();
  }

  /** Emit any buffered points immediately. */
  flush(): void {
    if (this.pending.length === 0) return;
    const bridged = this.lastEmitted ? [this.lastEmitted, ...this.pending] : [...this.pending];
    this.lastEmitted = bridged[bridged.length - 1] ?? null;
    this.pending = [];
    this.lastFlushAt = this.now();
    this.emitChunked(bridged);
  }

  /** Flush the tail and end the gesture. */
  end(): void {
    this.flush();
    this.active = false;
  }

  private emitChunked(points: Point[]): void {
    const max = this.maxPointsPerFrame;
    if (points.length <= max) {
      this.emit(points);
      return;
    }
    // Split oversized frames, overlapping by one point to keep them continuous.
    for (let i = 0; i < points.length; i += max - 1) {
      const chunk = points.slice(i, i + max);
      if (chunk.length > 0) this.emit(chunk);
      if (i + max >= points.length) break;
    }
  }

  private emit(points: Point[]): void {
    this.onFlush({
      points,
      color: this.style.color,
      width: this.style.width,
      mode: this.style.mode,
    });
  }
}
