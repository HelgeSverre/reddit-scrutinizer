import { describe, test, expect, mock, beforeEach } from "bun:test";
import { fixturePost, fixtureAgenda, fixtureComments } from "./fixtures/ai-responses";

let generateCalls: unknown[] = [];
mock.module("../src/ai/client", () => ({
  createClient: () => ({}),
  generateJSON: async (_client: unknown, system: string) => {
    let result: unknown;
    if (system.includes("posting to r/")) {
      result = fixturePost;
    } else if (system.includes("predicting what")) {
      result = fixtureAgenda;
    } else {
      result = fixtureComments;
    }
    generateCalls.push(result);
    return result;
  },
}));

import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import type Anthropic from "@anthropic-ai/sdk";
import { buildDossier } from "../src/scan/dossier";
import { loadVibePack } from "../src/ai/load-vibe";
import { generatePost } from "../src/ai/generate-post";
import { generateAgenda } from "../src/ai/generate-agenda";
import { generateComments } from "../src/ai/generate-comments";
import { assembleOutput, writeOutput } from "../src/output/write";
import { ScrutinyOutputSchema } from "../src/output/schema";

const SAMPLE_PROJECT = join(import.meta.dir, "fixtures/sample-project");

async function runPipeline(seed: number) {
  const dossier = await buildDossier(SAMPLE_PROJECT);
  const vibePack = loadVibePack("programming");
  const client = {} as Anthropic;
  const options = { model: "claude-sonnet-4-20250514", temperature: 0.7 };

  const post = await generatePost(client, dossier, vibePack, options);
  const agenda = await generateAgenda(client, dossier, vibePack, post, null, options);
  const comments = await generateComments(client, dossier, vibePack, post, agenda, null, {
    ...options,
    comments: 5,
    maxDepth: 3,
    maxReplies: 2,
    style: "mixed",
  });

  const output = assembleOutput({
    input: {
      path: SAMPLE_PROJECT,
      subreddit: "programming",
      model: "claude-sonnet-4-20250514",
      comments: 5,
      maxDepth: 3,
      maxReplies: 2,
      style: "mixed",
      seed,
    },
    project: {
      name: dossier.name,
      tagline: dossier.description,
      languages: dossier.languages.map((l) => ({ name: l.name, pct: l.pct })),
      stack: dossier.stack,
      facts: {
        has_tests: dossier.has_tests,
        has_ci: dossier.has_ci,
        license: dossier.license,
        files_scanned: dossier.excerpts.length,
        readme_excerpt: dossier.readme.slice(0, 500),
      },
    },
    post,
    comments,
    subreddit: "programming",
    seed,
  });

  return { dossier, vibePack, post, agenda, comments, output };
}

describe("E2E integration test with mocked LLM", () => {
  beforeEach(() => {
    generateCalls = [];
  });

  test("full pipeline produces valid output", async () => {
    const { dossier, vibePack, post, agenda, comments, output } = await runPipeline(42);

    // Dossier
    expect(dossier.name).toBeDefined();
    expect(dossier.languages.length).toBeGreaterThan(0);

    // Vibe pack
    expect(vibePack.subreddit).toBe("programming");

    // Post
    expect(post.title).toBe(fixturePost.title);
    expect(post.author).toBe(fixturePost.author);

    // Agenda
    expect(agenda).toHaveLength(fixtureAgenda.length);
    expect(agenda[0].topic).toBe("Testing");

    // Comments
    expect(comments).toHaveLength(fixtureComments.length);

    // Validate against schema
    const parsed = ScrutinyOutputSchema.parse(output);
    expect(parsed).toBeDefined();

    // Assert correct structure
    expect(output.schema_version).toBe("1.0");
    expect(output.generated_at).toBeDefined();
    expect(output.tool.name).toBe("reddit-scrutinizer");

    // Post has HTML
    expect(output.simulation.post.body_html).toContain("<");
    expect(output.simulation.post.title).toBe(fixturePost.title);
    expect(output.simulation.post.author).toBe(fixturePost.author);
    expect(output.simulation.post.score).toBeGreaterThan(0);
    expect(output.simulation.post.created_utc).toBeGreaterThan(0);

    // Comments have scores and timestamps
    for (const comment of output.simulation.comments) {
      expect(comment.score).toBeDefined();
      expect(typeof comment.score).toBe("number");
      expect(comment.created_utc).toBeGreaterThan(0);
      expect(comment.body_html).toBeDefined();
    }

    // Project info
    expect(output.project.name).toBe(dossier.name);
    expect(output.project.languages.length).toBeGreaterThan(0);

    // Input info preserved
    expect(output.input.subreddit).toBe("programming");
    expect(output.input.model).toBe("claude-sonnet-4-20250514");
  });

  test("output can be written to a temp file and read back", async () => {
    const { output } = await runPipeline(123);

    const tmpPath = join(tmpdir(), `reddit-scrutinizer-test-${Date.now()}.json`);
    try {
      await writeOutput(output, tmpPath);

      const raw = await readFile(tmpPath, "utf-8");
      const parsed = JSON.parse(raw);
      const validated = ScrutinyOutputSchema.parse(parsed);

      expect(validated.schema_version).toBe("1.0");
      expect(validated.simulation.post.title).toBe(fixturePost.title);
      expect(validated.simulation.comments).toHaveLength(fixtureComments.length);
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
  });

  test("calls generateJSON exactly 3 times (post, agenda, comments)", async () => {
    await runPipeline(42);
    expect(generateCalls).toHaveLength(3);
  });
});
