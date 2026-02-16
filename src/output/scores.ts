import type { Post, Comment } from "./schema";

class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Mulberry32 — returns float in [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random float in [min, max) */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

function logNormalish(rng: SeededRNG, min: number, max: number): number {
  // Box-Muller-ish: average two uniforms for a bell-ish shape, then scale
  const u = (rng.next() + rng.next()) / 2;
  // Bias toward the lower end with a power curve
  const skewed = Math.pow(u, 1.5);
  return Math.round(min + skewed * (max - min));
}

export function assignScores(
  comments: Pick<Comment, "depth" | "score" | "controversiality">[],
  seed: number,
): void {
  const rng = new SeededRNG(seed);

  for (const comment of comments) {
    const isControversial = rng.next() < 0.1;

    let score: number;
    if (comment.depth === 0) {
      score = logNormalish(rng, 20, 200);
    } else if (comment.depth === 1) {
      score = logNormalish(rng, 5, 80);
    } else {
      score = logNormalish(rng, 1, 30);
    }

    if (isControversial) {
      score = -Math.abs(score);
      comment.controversiality = 1;
    } else {
      comment.controversiality = 0;
    }

    comment.score = score;
  }
}

export function assignTimestamps(
  post: Pick<Post, "created_utc">,
  comments: Pick<Comment, "parent_id" | "depth" | "created_utc" | "id">[],
  seed: number,
): void {
  const rng = new SeededRNG(seed ^ 0xdeadbeef);

  // Post gets a base time: ~6 hours ago from a fixed reference
  const baseTime = 1739700000; // stable epoch reference
  post.created_utc = baseTime;

  // Index comments by id for parent lookup
  const timeById = new Map<string, number>();
  timeById.set(post.created_utc.toString(), baseTime);

  // Process in order — top-level first, then deeper
  const sorted = [...comments].sort((a, b) => a.depth - b.depth);

  let lastTopLevelTime = baseTime;

  for (const comment of sorted) {
    let parentTime: number;

    if (comment.depth === 0) {
      // Top-level: 5-120 minutes after the last top-level comment
      const gap = rng.int(5, 120) * 60;
      lastTopLevelTime += gap;
      parentTime = lastTopLevelTime;
    } else {
      // Reply: 10-180 minutes after parent
      const lookedUp = timeById.get(comment.parent_id);
      parentTime = (lookedUp ?? lastTopLevelTime) + rng.int(10, 180) * 60;
    }

    comment.created_utc = parentTime;
    timeById.set(comment.id, parentTime);
  }
}
