#!/usr/bin/env bun

import { program } from "./cli";
import chalk from "chalk";
import { resolve } from "node:path";
import { buildDossier } from "./scan/dossier";
import { walkDirectory } from "./scan/walk";
import { buildFileIndex, scanRiskPatterns, executeDiscoveryPlan } from "./scan/snippets";
import { loadVibePack } from "./ai/load-vibe";
import { createClient } from "./ai/client";
import { planDiscovery, synthesizeEvidence } from "./ai/discover";
import { generatePost } from "./ai/generate-post";
import { generateAgenda } from "./ai/generate-agenda";
import { generateComments, type CommentOptions } from "./ai/generate-comments";
import { assembleOutput, writeOutput } from "./output/write";

interface RunOptions {
  subreddit: string;
  comments: number;
  maxDepth: number;
  maxReplies: number;
  style: string;
  model: string;
  out: string;
  open: boolean;
  port: number;
  ui: boolean;
  theme: string;
  temperature: number;
  seed?: number;
  maxTokens?: number;
  batchSize: number;
}

async function run(path: string, options: RunOptions) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(chalk.red("Error: ANTHROPIC_API_KEY environment variable required"));
    console.error(chalk.dim("Set it: export ANTHROPIC_API_KEY=sk-ant-..."));
    process.exit(1);
  }

  const seed = options.seed ?? Date.now();
  const rootPath = resolve(path);

  // 1. Build dossier
  console.log(chalk.cyan(`Scanning ${rootPath}...`));
  const dossier = await buildDossier(rootPath);
  const langNames = dossier.languages.map((l) => l.name).join(", ");
  const fileCount = dossier.excerpts.length;
  console.log(chalk.dim(`Found ${fileCount} key files, languages detected: ${langNames}`));

  // 2. Load vibe pack and create client
  const vibePack = loadVibePack(options.subreddit);
  const client = createClient(apiKey);
  const genOptions = { model: options.model, temperature: options.temperature };

  // 3. AI-driven code discovery
  console.log(chalk.cyan("Discovering code patterns..."));
  const files = await walkDirectory(rootPath);
  const fileIndex = buildFileIndex(files);
  const patternSummary = await scanRiskPatterns(rootPath, files);
  if (patternSummary.signals.length > 0) {
    console.log(chalk.dim(`Found ${patternSummary.signals.length} risk signals across ${patternSummary.total_files_with_signals} files`));
  }

  console.log(chalk.cyan("Planning targeted code reads..."));
  const discoveryPlan = await planDiscovery(client, dossier, fileIndex, patternSummary, genOptions);
  console.log(chalk.dim(`Reading ${discoveryPlan.reads.length} code regions...`));
  const snippets = await executeDiscoveryPlan(rootPath, discoveryPlan);

  console.log(chalk.cyan("Synthesizing evidence..."));
  const evidence = await synthesizeEvidence(client, dossier, snippets, genOptions);
  console.log(chalk.dim(`Found ${evidence.strengths.length} strengths, ${evidence.risks.length} risks, ${evidence.comment_ammo.length} comment angles`));

  // 4. Generate post
  console.log(chalk.cyan(`Generating r/${options.subreddit} post...`));
  const post = await generatePost(client, dossier, vibePack, genOptions);

  // 5. Generate agenda
  console.log(chalk.cyan("Analyzing critique themes..."));
  const agenda = await generateAgenda(client, dossier, vibePack, post, evidence, genOptions);

  // 6. Generate comments (batched for large counts)
  const batchSize = options.batchSize;
  if (options.comments > batchSize) {
    const batches = Math.ceil(options.comments / batchSize);
    console.log(chalk.cyan(`Generating ${options.comments} comments in ${batches} batches of ~${batchSize}...`));
  } else {
    console.log(chalk.cyan(`Generating ${options.comments} comments...`));
  }
  const commentOpts: CommentOptions = {
    ...genOptions,
    maxTokens: options.maxTokens,
    comments: options.comments,
    maxDepth: options.maxDepth,
    maxReplies: options.maxReplies,
    style: options.style,
    batchSize,
  };
  const comments = await generateComments(client, dossier, vibePack, post, agenda, evidence, commentOpts);

  // 7. Assemble and write output
  console.log(chalk.cyan("Assembling output..."));
  const output = assembleOutput({
    input: {
      path: rootPath,
      subreddit: options.subreddit,
      model: options.model,
      comments: options.comments,
      maxDepth: options.maxDepth,
      maxReplies: options.maxReplies,
      style: options.style,
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
        files_scanned: fileCount,
        readme_excerpt: dossier.readme.slice(0, 500),
      },
    },
    post: {
      title: post.title,
      body_md: post.body_md,
      author: post.author,
      author_flair: post.author_flair,
      post_flair: post.post_flair,
    },
    comments,
    subreddit: options.subreddit,
    seed,
  });

  const outPath = resolve(options.out);
  await writeOutput(output, outPath);
  console.log(chalk.green(`Written to ${outPath}`));

  // 8. Start UI server (unless --no-ui)
  if (options.ui) {
    const { startServer } = await import("./ui/server");
    const actualPort = await startServer(outPath, options.port, options.open, options.theme);
    console.log(chalk.cyan(`UI available at http://localhost:${actualPort}`));
  }
}

// Wire up the default command action
program.action(async (path: string) => {
  const options = program.opts() as unknown as RunOptions;
  await run(path, options);
});

program.parseAsync().catch((err) => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});
