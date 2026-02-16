import { describe, test, expect } from "bun:test";
import { assembleOutput, type AssembleOptions } from "../../src/output/write";
import { fixturePost, fixtureComments } from "../fixtures/ai-responses";

function makeOptions(seed: number): AssembleOptions {
  return {
    input: {
      path: "/tmp/test-project",
      subreddit: "programming",
      model: "claude-sonnet-4-20250514",
      comments: 5,
      maxDepth: 2,
      maxReplies: 3,
      style: "balanced",
      seed,
    },
    project: {
      name: "test-project",
      tagline: "A test project",
      languages: [{ name: "TypeScript", pct: 80 }],
      stack: ["bun", "typescript"],
      facts: {
        has_tests: true,
        has_ci: false,
        license: "MIT",
        files_scanned: 10,
        readme_excerpt: "A simple project.",
      },
    },
    post: fixturePost,
    comments: fixtureComments,
    subreddit: "programming",
    seed,
  };
}

describe("randomId (via assembleOutput)", () => {
  test("deterministic post IDs — same seed produces same ID", () => {
    const a = assembleOutput(makeOptions(42));
    const b = assembleOutput(makeOptions(42));
    expect(a.simulation.post.id).toBe(b.simulation.post.id);
  });

  test("different seeds produce different post IDs", () => {
    const a = assembleOutput(makeOptions(42));
    const b = assembleOutput(makeOptions(99));
    expect(a.simulation.post.id).not.toBe(b.simulation.post.id);
  });

  test("post ID starts with 't3_'", () => {
    const output = assembleOutput(makeOptions(1));
    expect(output.simulation.post.id).toStartWith("t3_");
  });

  test("post ID has correct length (t3_ + 6 chars)", () => {
    const output = assembleOutput(makeOptions(1));
    expect(output.simulation.post.id).toHaveLength(9);
  });
});
