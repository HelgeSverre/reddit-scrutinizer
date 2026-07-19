import { describe, test, expect } from "bun:test";
import { assignScores, assignTimestamps } from "../../src/output/scores";

function makeComments(
  count: number,
  depth: number,
  parentId = "post",
): {
  id: string;
  parent_id: string;
  depth: number;
  score: number;
  controversiality: 0 | 1;
  created_utc: number;
}[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${depth}_${i}`,
    parent_id: parentId,
    depth,
    score: 0,
    controversiality: 0 as const,
    created_utc: 0,
  }));
}

describe("assignScores", () => {
  test("same seed produces same scores (deterministic)", () => {
    const a = makeComments(10, 0);
    const b = makeComments(10, 0);
    assignScores(a, 42);
    assignScores(b, 42);
    expect(a.map((c) => c.score)).toEqual(b.map((c) => c.score));
    expect(a.map((c) => c.controversiality)).toEqual(b.map((c) => c.controversiality));
  });

  test("different seeds produce different scores", () => {
    const a = makeComments(10, 0);
    const b = makeComments(10, 0);
    assignScores(a, 42);
    assignScores(b, 999);
    const same = a.every((c, i) => c.score === b.at(i)?.score);
    expect(same).toBe(false);
  });

  test("depth 0 comments get scores in range 20-200 (non-controversial)", () => {
    const comments = makeComments(50, 0);
    assignScores(comments, 123);
    const nonControversial = comments.filter((c) => c.controversiality === 0);
    for (const c of nonControversial) {
      expect(c.score).toBeGreaterThanOrEqual(20);
      expect(c.score).toBeLessThanOrEqual(200);
    }
  });

  test("depth 1 comments get lower scores than depth 0 on average", () => {
    const d0 = makeComments(100, 0);
    const d1 = makeComments(100, 1);
    assignScores(d0, 42);
    assignScores(d1, 42);

    const avg0 =
      d0.filter((c) => c.controversiality === 0).reduce((s, c) => s + c.score, 0) /
      d0.filter((c) => c.controversiality === 0).length;
    const avg1 =
      d1.filter((c) => c.controversiality === 0).reduce((s, c) => s + c.score, 0) /
      d1.filter((c) => c.controversiality === 0).length;

    expect(avg0).toBeGreaterThan(avg1);
  });

  test("controversial comments get controversiality 1 and negative scores", () => {
    // Use enough comments so that at least one is controversial (~10% chance each)
    const comments = makeComments(100, 0);
    assignScores(comments, 42);
    const controversial = comments.filter((c) => c.controversiality === 1);
    expect(controversial.length).toBeGreaterThan(0);
    for (const c of controversial) {
      expect(c.score).toBeLessThan(0);
    }
  });

  test("empty array doesn't crash", () => {
    expect(() => assignScores([], 42)).not.toThrow();
  });
});

describe("assignTimestamps", () => {
  const baseTime = 1739700000;

  test("post gets created_utc set to baseTime", () => {
    const post = { created_utc: 0 };
    assignTimestamps(post, "t3_abc", [], 42);
    expect(post.created_utc).toBe(baseTime);
  });

  test("same seed produces same timestamps (deterministic)", () => {
    const post1 = { created_utc: 0 };
    const post2 = { created_utc: 0 };
    const c1 = makeComments(5, 0);
    const c2 = makeComments(5, 0);
    assignTimestamps(post1, "t3_abc", c1, 42);
    assignTimestamps(post2, "t3_abc", c2, 42);
    expect(c1.map((c) => c.created_utc)).toEqual(c2.map((c) => c.created_utc));
  });

  test("top-level comments get timestamps after the post", () => {
    const post = { created_utc: 0 };
    const comments = makeComments(5, 0);
    assignTimestamps(post, "t3_abc", comments, 42);
    for (const c of comments) {
      expect(c.created_utc).toBeGreaterThan(post.created_utc);
    }
  });

  test("replies get timestamps after their parent", () => {
    const post = { created_utc: 0 };
    const parent = makeComments(1, 0).at(0);
    expect(parent).toBeDefined();
    if (!parent) throw new Error("parent fixture was not created");
    const reply = makeComments(1, 1, parent.id).at(0);
    expect(reply).toBeDefined();
    if (!reply) throw new Error("reply fixture was not created");
    reply.parent_id = parent.id;
    const comments = [parent, reply];
    assignTimestamps(post, "t3_abc", comments, 42);
    expect(reply.created_utc).toBeGreaterThan(parent.created_utc);
  });

  test("replies get timestamps after their specific parent", () => {
    const post = { created_utc: 0 };
    const topLevel = makeComments(3, 0);
    const replies = topLevel.map((p) => {
      const r = makeComments(1, 1, p.id).at(0);
      if (!r) throw new Error("reply fixture was not created");
      r.parent_id = p.id;
      return r;
    });
    const comments = [...topLevel, ...replies];
    assignTimestamps(post, "t3_abc", comments, 42);

    for (const reply of replies) {
      const parent = topLevel.find((p) => p.id === reply.parent_id);
      expect(parent).toBeDefined();
      if (!parent) throw new Error(`parent ${reply.parent_id} was not found`);
      expect(reply.created_utc).toBeGreaterThan(parent.created_utc);
    }
  });

  test("empty array doesn't crash", () => {
    const post = { created_utc: 0 };
    expect(() => assignTimestamps(post, "t3_abc", [], 42)).not.toThrow();
    expect(post.created_utc).toBe(baseTime);
  });
});
