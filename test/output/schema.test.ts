import { describe, test, expect } from "bun:test";
import {
  PostSchema,
  CommentSchema,
  ScrutinyOutputSchema,
} from "../../src/output/schema";

const validPost = {
  id: "t3_abc123",
  title: "Test Post",
  body_md: "Hello world",
  body_html: "<p>Hello world</p>",
  author: "testuser",
  author_flair: null,
  post_flair: null,
  score: 100,
  upvote_ratio: 0.85,
  created_utc: 1739700000,
  awards: [],
};

const validComment = {
  id: "c1",
  parent_id: "t3_abc123",
  author: "commenter",
  author_flair: null,
  is_op: false,
  body_md: "Nice post!",
  body_html: "<p>Nice post!</p>",
  score: 10,
  controversiality: 0 as 0 | 1,
  created_utc: 1739700300,
  depth: 0,
  is_deleted: false,
};

const validOutput = {
  schema_version: "1.0" as const,
  generated_at: new Date().toISOString(),
  tool: { name: "reddit-scrutinizer" as const, version: "0.1.0" },
  input: {
    path: "/tmp/test",
    subreddit: "programming",
    model: "claude-sonnet-4-20250514",
    comments: 5,
    max_depth: 2,
    max_replies: 3,
    style: "balanced",
    seed: 42,
  },
  project: {
    name: "test-project",
    tagline: "A test project",
    languages: [{ name: "TypeScript", pct: 80 }],
    stack: ["bun"],
    facts: {
      has_tests: true,
      has_ci: false,
      license: "MIT",
      files_scanned: 10,
      readme_excerpt: "A project.",
    },
  },
  simulation: {
    subreddit: { name: "programming", display: "r/programming" },
    post: validPost,
    comments: [validComment],
  },
};

describe("PostSchema", () => {
  test("valid data passes", () => {
    expect(PostSchema.safeParse(validPost).success).toBe(true);
  });

  test("missing required fields fail", () => {
    const { title, ...missing } = validPost;
    expect(PostSchema.safeParse(missing).success).toBe(false);
  });
});

describe("CommentSchema", () => {
  test("valid data passes", () => {
    expect(CommentSchema.safeParse(validComment).success).toBe(true);
  });

  test("missing required fields fail", () => {
    const { body_md, ...missing } = validComment;
    expect(CommentSchema.safeParse(missing).success).toBe(false);
  });

  test("invalid controversiality values (not 0 or 1) fail", () => {
    expect(
      CommentSchema.safeParse({ ...validComment, controversiality: 2 }).success,
    ).toBe(false);
    expect(
      CommentSchema.safeParse({ ...validComment, controversiality: -1 })
        .success,
    ).toBe(false);
    expect(
      CommentSchema.safeParse({ ...validComment, controversiality: 0.5 })
        .success,
    ).toBe(false);
  });

  test("controversiality 0 and 1 both pass", () => {
    expect(
      CommentSchema.safeParse({ ...validComment, controversiality: 0 }).success,
    ).toBe(true);
    expect(
      CommentSchema.safeParse({ ...validComment, controversiality: 1 }).success,
    ).toBe(true);
  });
});

describe("ScrutinyOutputSchema", () => {
  test("valid data passes", () => {
    expect(ScrutinyOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  test("schema_version must be '1.0'", () => {
    expect(
      ScrutinyOutputSchema.safeParse({ ...validOutput, schema_version: "2.0" })
        .success,
    ).toBe(false);
  });

  test("missing required fields fail", () => {
    const { simulation, ...missing } = validOutput;
    expect(ScrutinyOutputSchema.safeParse(missing).success).toBe(false);
  });
});
