import { beforeEach, describe, expect, test } from "bun:test";
import type { AIClient } from "../../src/ai/client";
import {
  generateComments,
  type CommentBatchProgress,
  type CommentOptions,
} from "../../src/ai/generate-comments";
import type { ProjectDossier } from "../../src/scan/dossier";
import { resetAISDKMock, setGenerateTextHandler } from "../fixtures/ai-sdk-mock";

const client = ((modelId: string) => ({ modelId })) as AIClient;
const dossier = {
  name: "test-project",
  description: "A test project",
  languages: [{ name: "TypeScript", pct: 100 }],
  stack: ["Bun"],
  has_tests: true,
  license: "MIT",
} as ProjectDossier;
const vibePack = { subreddit: "programming" };
const post = {
  title: "A test project",
  body_md: "Please be gentle.",
  author: "op",
  author_flair: null,
  post_flair: null,
};
const options: CommentOptions = {
  model: "test-model",
  temperature: 0.8,
  comments: 3,
  maxDepth: 3,
  maxReplies: 1,
  style: "balanced",
  batchSize: 2,
};

function comment(id: string) {
  return {
    id,
    parent_id: "post",
    author: `user-${id}`,
    author_flair: null,
    is_op: false,
    body_md: `Comment ${id}`,
    depth: 0,
    is_deleted: false,
  };
}

beforeEach(() => resetAISDKMock());

describe("generateComments batching", () => {
  test("reports batch start and completion with cumulative totals", async () => {
    const responses = [[comment("local-1"), comment("local-2")], [comment("local-1")]];
    const events: CommentBatchProgress[] = [];
    setGenerateTextHandler(() => ({
      output: responses.shift(),
      finishReason: "stop",
      warnings: undefined,
    }));

    const result = await generateComments(client, dossier, vibePack, post, [], null, {
      ...options,
      onBatchProgress: (event) => events.push(event),
    });

    expect(result.map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
    expect(events).toEqual([
      {
        phase: "start",
        batch: 1,
        totalBatches: 2,
        requested: 2,
        generated: 0,
        totalGenerated: 0,
        remaining: 3,
      },
      {
        phase: "complete",
        batch: 1,
        totalBatches: 2,
        requested: 2,
        generated: 2,
        totalGenerated: 2,
        remaining: 1,
      },
      {
        phase: "start",
        batch: 2,
        totalBatches: 2,
        requested: 1,
        generated: 0,
        totalGenerated: 2,
        remaining: 1,
      },
      {
        phase: "complete",
        batch: 2,
        totalBatches: 2,
        requested: 1,
        generated: 1,
        totalGenerated: 3,
        remaining: 0,
      },
    ]);
  });

  test("fails clearly when a batch returns no comments", async () => {
    setGenerateTextHandler(() => ({ output: [], finishReason: "stop", warnings: undefined }));

    await expect(
      generateComments(client, dossier, vibePack, post, [], null, options),
    ).rejects.toThrow("AI returned no comments for batch 1 of 2");
  });

  test("fails clearly when a batch returns fewer comments than requested", async () => {
    setGenerateTextHandler(() => ({
      output: [comment("local-1")],
      finishReason: "stop",
      warnings: undefined,
    }));

    await expect(
      generateComments(client, dossier, vibePack, post, [], null, {
        ...options,
        comments: 2,
        batchSize: 3,
      }),
    ).rejects.toThrow("AI returned 1 comment for batch 1 of 1; expected exactly 2");
  });

  test("truncates comments beyond the requested batch size", async () => {
    setGenerateTextHandler(() => ({
      output: [comment("local-1"), comment("local-2"), comment("local-3")],
      finishReason: "stop",
      warnings: undefined,
    }));

    const result = await generateComments(client, dossier, vibePack, post, [], null, {
      ...options,
      comments: 2,
      batchSize: 3,
    });

    expect(result.map((item) => item.id)).toEqual(["local-1", "local-2"]);
  });

  test("truncates an oversized continuation batch before reporting progress", async () => {
    const responses = [
      [comment("local-1"), comment("local-2")],
      [comment("local-1"), comment("local-2"), comment("local-3")],
    ];
    const events: CommentBatchProgress[] = [];
    setGenerateTextHandler(() => ({
      output: responses.shift(),
      finishReason: "stop",
      warnings: undefined,
    }));

    const result = await generateComments(client, dossier, vibePack, post, [], null, {
      ...options,
      onBatchProgress: (event) => events.push(event),
    });

    expect(result.map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
    expect(events.at(-1)).toEqual({
      phase: "complete",
      batch: 2,
      totalBatches: 2,
      requested: 1,
      generated: 1,
      totalGenerated: 3,
      remaining: 0,
    });
  });
});
