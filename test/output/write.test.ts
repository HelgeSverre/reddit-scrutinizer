import { describe, test, expect } from "bun:test";
import { assembleOutput, type AssembleOptions } from "../../src/output/write";
import { fixturePost, fixtureComments } from "../fixtures/ai-responses";
import { ScrutinyOutputSchema } from "../../src/output/schema";
import pkg from "../../package.json";

function makeOptions(seed = 42): AssembleOptions {
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

describe("assembleOutput", () => {
  test("produces valid structure with all required fields", () => {
    const output = assembleOutput(makeOptions());
    const result = ScrutinyOutputSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  test("parent_id 'post' gets replaced with actual post ID", () => {
    const output = assembleOutput(makeOptions());
    const postId = output.simulation.post.id;
    expect(postId).toStartWith("t3_");

    const topLevel = output.simulation.comments.filter((c) => c.depth === 0);
    for (const c of topLevel) {
      expect(c.parent_id).toBe(postId);
      expect(c.parent_id).not.toBe("post");
    }
  });

  test("post score is calculated from top-level comment scores", () => {
    const output = assembleOutput(makeOptions());
    const expectedScore = output.simulation.comments
      .filter((c) => c.depth === 0)
      .reduce((sum, c) => sum + Math.abs(c.score), 0);
    expect(output.simulation.post.score).toBe(expectedScore);
  });

  test("comments get scores and timestamps assigned", () => {
    const output = assembleOutput(makeOptions());
    for (const c of output.simulation.comments) {
      expect(typeof c.score).toBe("number");
      expect(c.created_utc).toBeGreaterThan(0);
    }
    // Deleted comments still get scores/timestamps
    const deleted = output.simulation.comments.find((c) => c.is_deleted);
    expect(deleted).toBeDefined();
    expect(deleted!.created_utc).toBeGreaterThan(0);
  });

  test("HTML is generated from markdown in both post and comments", () => {
    const output = assembleOutput(makeOptions());
    // Post body contains markdown features that should be converted
    expect(output.simulation.post.body_html).toContain("<strong>");
    expect(output.simulation.post.body_html).toContain("</p>");
    // Comment with **Docker** should produce <strong>
    const dockerComment = output.simulation.comments.find((c) => c.body_md.includes("**Docker**"));
    expect(dockerComment).toBeDefined();
    expect(dockerComment!.body_html).toContain("<strong>Docker</strong>");
  });

  test("schema_version is '1.0'", () => {
    const output = assembleOutput(makeOptions());
    expect(output.schema_version).toBe("1.0");
  });

  test("tool version matches package.json", () => {
    const output = assembleOutput(makeOptions());
    expect(output.tool.version).toBe(pkg.version);
  });

  test("upvote_ratio with negative seed stays in [0.75, 0.95]", () => {
    const output = assembleOutput(makeOptions(-5));
    expect(output.simulation.post.upvote_ratio).toBeGreaterThanOrEqual(0.75);
    expect(output.simulation.post.upvote_ratio).toBeLessThanOrEqual(0.95);
  });
});
