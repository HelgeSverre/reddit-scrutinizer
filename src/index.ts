#!/usr/bin/env bun

import { program, type MainOptions } from "./cli";
import chalk from "chalk";
import { resolve } from "node:path";
import { stat } from "node:fs/promises";
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
import { createProgressReporter } from "./progress";

async function run(path: string, options: MainOptions) {
  const progress = createProgressReporter({ verbose: options.verbose });
  let apiKey: string | undefined;
  let apiKeySource: string;

  if (options.apiKey) {
    apiKey = options.apiKey;
    apiKeySource = "--api-key flag";
    if (process.stderr.isTTY && !process.env.CI) {
      progress.warn("API key passed via CLI; it may appear in shell history and process listings.");
      progress.warn("Prefer: export ANTHROPIC_API_KEY=sk-ant-...");
    }
  } else if (process.env.ANTHROPIC_API_KEY) {
    apiKey = process.env.ANTHROPIC_API_KEY;
    apiKeySource = "ANTHROPIC_API_KEY env var";
  } else {
    console.error(chalk.red("Error: No API key provided"));
    console.error(chalk.dim("Set it: export ANTHROPIC_API_KEY=sk-ant-..."));
    console.error(chalk.dim("Or pass: --api-key sk-ant-..."));
    process.exit(1);
  }

  const seed = options.seed ?? Date.now();
  const rootPath = resolve(path);
  progress.detail(`API key source: ${apiKeySource}`);
  progress.detail(
    `Run: r/${options.subreddit}; ${options.style} style; ${options.theme} theme; ${options.model}`,
  );
  progress.detail(
    `Comments: ${options.comments}; batch size: ${options.batchSize}; seed: ${seed}; open UI: ${options.open}`,
  );
  progress.detail(`Project: ${rootPath}`);

  const scanStage = progress.stage(1, 8, "Rifling through the repo...");
  const dossier = await buildDossier(rootPath);
  const langNames = dossier.languages.map((l) => l.name).join(", ");
  const fileCount = dossier.excerpts.length;
  scanStage.detail(`Key excerpts: ${fileCount}; languages: ${langNames || "none detected"}`);
  scanStage.detail(
    `Stack: ${dossier.stack.join(", ") || "none detected"}; tests: ${dossier.has_tests}; CI: ${dossier.has_ci}; license: ${dossier.license ?? "none"}`,
  );
  scanStage.complete("Project dossier assembled");

  const vibePack = loadVibePack(options.subreddit);
  const client = createClient(apiKey);
  const genOptions = {
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  };

  const patternsStage = progress.stage(2, 8, "Checking under the floorboards...");
  const files = await walkDirectory(rootPath);
  const fileIndex = buildFileIndex(files);
  const patternSummary = await scanRiskPatterns(rootPath, files);
  patternsStage.detail(
    `Indexed ${fileIndex.total_scanned} files; kept ${fileIndex.files.length} for AI planning`,
  );
  patternsStage.detail(
    `${patternSummary.signals.length} risk signals across ${patternSummary.total_files_with_signals} files`,
  );
  for (const signal of patternSummary.signals.slice(0, 10)) {
    patternsStage.detail(`${signal.file}: ${signal.pattern} ×${signal.count}`);
  }
  if (patternSummary.signals.length > 10) {
    patternsStage.detail(`...and ${patternSummary.signals.length - 10} more signals`);
  }
  patternsStage.complete("Pattern scan complete");

  const planStage = progress.stage(3, 8, "Asking Claude where the bodies are buried...");
  const discoveryPlan = await planDiscovery(client, dossier, fileIndex, patternSummary, genOptions);
  for (const read of discoveryPlan.reads) {
    planStage.detail(
      `${read.path}:${read.start_line}-${read.start_line + read.line_count - 1} — ${read.reason}`,
    );
  }
  const snippets = await executeDiscoveryPlan(rootPath, discoveryPlan);
  planStage.complete(`Read ${snippets.length} of ${discoveryPlan.reads.length} selected regions`);

  const evidenceStage = progress.stage(4, 8, "Turning code into ammunition...");
  const evidence = await synthesizeEvidence(client, dossier, snippets, genOptions);
  evidenceStage.complete(
    `${evidence.strengths.length} strengths, ${evidence.risks.length} risks, ${evidence.comment_ammo.length} comment angles`,
  );

  const postStage = progress.stage(5, 8, `Composing the r/${options.subreddit} bait...`);
  const post = await generatePost(client, dossier, vibePack, genOptions);
  postStage.complete("Submission drafted");

  const agendaStage = progress.stage(6, 8, "Giving the mob some talking points...");
  const agenda = await generateAgenda(client, dossier, vibePack, post, evidence, genOptions);
  agendaStage.complete(`${agenda.length} critique themes ready`);

  const batchSize = options.batchSize;
  const commentsStage = progress.stage(7, 8, "Opening the comment floodgates...");
  const commentOpts: CommentOptions = {
    ...genOptions,
    maxTokens: options.maxTokens,
    comments: options.comments,
    maxDepth: options.maxDepth,
    maxReplies: options.maxReplies,
    style: options.style,
    batchSize,
    onBatchProgress: (event) => {
      if (event.phase === "start") {
        commentsStage.detail(
          `Batch ${event.batch}/${event.totalBatches}: requesting ${event.requested} comments (${event.remaining} remaining)`,
        );
      } else {
        commentsStage.detail(
          `Batch ${event.batch}/${event.totalBatches}: received ${event.generated}; ${event.totalGenerated} total`,
        );
      }
    },
  };
  const comments = await generateComments(
    client,
    dossier,
    vibePack,
    post,
    agenda,
    evidence,
    commentOpts,
  );
  commentsStage.complete(`${comments.length} comments generated`);

  const outputStage = progress.stage(8, 8, "Stuffing the simulation into JSON...");
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
  const outputStats = await stat(outPath);
  outputStage.detail(`Output: ${outPath} (${outputStats.size.toLocaleString()} bytes)`);

  let actualPort: number | undefined;
  if (options.open) {
    const { startServer } = await import("./ui/server");
    actualPort = await startServer(outPath, options.port, true, options.theme);
    outputStage.detail(
      actualPort === options.port
        ? `UI using preferred port ${actualPort}`
        : `Port ${options.port} was busy; UI moved to ${actualPort}`,
    );
  }
  outputStage.complete(options.open ? "Output written and UI started" : "Output written");
  progress.success(`Written to ${outPath}`);
  if (actualPort !== undefined) {
    progress.success(`UI available at http://localhost:${actualPort}`);
  }
}

// Wire up the default command action
program.action(async (path: string, options: MainOptions) => {
  await run(path, options);
});

program.parseAsync().catch((err) => {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});
