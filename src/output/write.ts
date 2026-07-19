import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ScrutinyOutput, Post, Comment } from "./schema";
import { assignScores, assignTimestamps } from "./scores";
import { mdToHtml } from "./markdown";
import { TOOL_VERSION } from "../version";

export interface AssembleOptions {
  input: {
    path: string;
    subreddit: string;
    model: string;
    comments: number;
    maxDepth: number;
    maxReplies: number;
    style: string;
    seed: number | null;
  };
  project: {
    name: string;
    tagline: string;
    languages: { name: string; pct: number }[];
    stack: string[];
    facts: {
      has_tests: boolean;
      has_ci: boolean;
      license: string | null;
      files_scanned: number;
      readme_excerpt: string;
    };
  };
  post: {
    title: string;
    body_md: string;
    author: string;
    author_flair: string | null;
    post_flair: string | null;
  };
  comments: {
    id: string;
    parent_id: string;
    author: string;
    author_flair: string | null;
    is_op: boolean;
    body_md: string;
    depth: number;
    is_deleted: boolean;
  }[];
  subreddit: string;
  seed: number;
}

function randomId(length: number, seed: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let state = seed | 0;
  let result = "";
  for (let i = 0; i < length; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const idx = ((t ^ (t >>> 14)) >>> 0) % chars.length;
    result += chars[idx];
  }
  return result;
}

export function assembleOutput(opts: AssembleOptions): ScrutinyOutput {
  const postId = "t3_" + randomId(6, opts.seed);

  const post: Post = {
    id: postId,
    title: opts.post.title,
    body_md: opts.post.body_md,
    body_html: mdToHtml(opts.post.body_md),
    author: opts.post.author,
    author_flair: opts.post.author_flair,
    post_flair: opts.post.post_flair,
    score: 0,
    upvote_ratio: 0,
    created_utc: 0,
    awards: [],
  };

  const comments: Comment[] = opts.comments.map((c) => ({
    id: c.id,
    parent_id: c.parent_id === "post" ? postId : c.parent_id,
    author: c.author,
    author_flair: c.author_flair,
    is_op: c.is_op,
    body_md: c.body_md,
    body_html: mdToHtml(c.body_md),
    score: 0,
    controversiality: 0 as const,
    created_utc: 0,
    depth: c.depth,
    is_deleted: c.is_deleted,
  }));

  assignScores(comments, opts.seed);
  assignTimestamps(post, postId, comments, opts.seed);

  // Post score: sum of top-level comment scores, roughly
  post.score = comments.filter((c) => c.depth === 0).reduce((sum, c) => sum + Math.abs(c.score), 0);
  post.upvote_ratio = 0.85 + (opts.seed % 10) * 0.01;

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    tool: {
      name: "reddit-scrutinizer",
      version: TOOL_VERSION,
    },
    input: {
      path: opts.input.path,
      subreddit: opts.input.subreddit,
      model: opts.input.model,
      comments: opts.input.comments,
      max_depth: opts.input.maxDepth,
      max_replies: opts.input.maxReplies,
      style: opts.input.style,
      seed: opts.input.seed,
    },
    project: opts.project,
    simulation: {
      subreddit: {
        name: opts.subreddit,
        display: `r/${opts.subreddit}`,
      },
      post,
      comments,
    },
  };
}

export async function writeOutput(output: ScrutinyOutput, outPath: string): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");
}
