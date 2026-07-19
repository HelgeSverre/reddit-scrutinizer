import { z } from "zod";
import type { ProjectDossier } from "../scan/dossier";
import { generateJSON, type AIClient, type GenerateOptions } from "./client";
import type { GeneratedPost } from "./generate-post";
import type { AgendaItem } from "./generate-agenda";
import type { EvidencePack } from "./discover";

const GeneratedCommentSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  author: z.string(),
  author_flair: z.string().nullable(),
  is_op: z.boolean(),
  body_md: z.string(),
  depth: z.number(),
  is_deleted: z.boolean(),
});

export interface GeneratedComment {
  id: string;
  parent_id: string;
  author: string;
  author_flair: string | null;
  is_op: boolean;
  body_md: string;
  depth: number;
  is_deleted: boolean;
}

const STYLE_DESCRIPTIONS: Record<string, string> = {
  balanced:
    "Mix of supportive, skeptical, snarky, pedantic, and helpful comments. Realistic distribution.",
  snarky:
    "Predominantly snarky and sarcastic. Comments drip with wit and condescension, but occasional genuine insight shines through.",
  supportive:
    "Predominantly encouraging and constructive. Critics still exist but are outnumbered by genuine enthusiasm.",
  hostile:
    "Predominantly aggressive and dismissive. Comments attack decisions, question competence, and pile on. A bad day on Reddit.",
  roast:
    "Pure roast. Every comment finds flaws, mocks choices, and piles on. No praise survives. Comedy through cruelty.",
  scrutiny:
    "Laser-focused technical critique. Every comment dissects architecture, questions decisions, and demands justification. Constructive but relentless — nothing gets a pass.",
  fanboy:
    "Unconditional praise and hype. Everything is brilliant, innovative, and inspiring. Comments compete to out-enthusiasm each other. The creator can do no wrong.",
  slop: "Anti-AI pile-on. Every commenter assumes the project is AI-generated slop. Comments accuse OP of using ChatGPT/Copilot, mass-downvote, demand to see 'the real code you wrote', mock AI-assisted README prose, and treat any use of AI tools as a personal insult to the craft. Typical Reddit AI backlash.",
};

export const DEFAULT_BATCH_SIZE = 50;

export interface CommentOptions extends GenerateOptions {
  comments: number;
  maxDepth: number;
  maxReplies: number;
  style: string;
  batchSize: number;
  onBatchProgress?: (event: CommentBatchProgress) => void;
}

export interface CommentBatchProgress {
  phase: "start" | "complete";
  batch: number;
  totalBatches: number;
  requested: number;
  generated: number;
  totalGenerated: number;
  remaining: number;
}

export async function generateComments(
  client: AIClient,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  post: GeneratedPost,
  agenda: AgendaItem[],
  evidence: EvidencePack | null,
  options: CommentOptions,
): Promise<GeneratedComment[]> {
  const batchSize = options.batchSize;
  const totalBatches = Math.ceil(options.comments / batchSize);

  if (options.comments <= batchSize) {
    options.onBatchProgress?.({
      phase: "start",
      batch: 1,
      totalBatches,
      requested: options.comments,
      generated: 0,
      totalGenerated: 0,
      remaining: options.comments,
    });
    const generatedBatch = await generateCommentBatch(
      client,
      dossier,
      vibePack,
      post,
      agenda,
      evidence,
      options,
      [],
    );
    const batch = normalizeBatchSize(generatedBatch, options.comments, 1, totalBatches);
    options.onBatchProgress?.({
      phase: "complete",
      batch: 1,
      totalBatches,
      requested: options.comments,
      generated: batch.length,
      totalGenerated: batch.length,
      remaining: Math.max(0, options.comments - batch.length),
    });
    return batch;
  }

  // Generate in batches to avoid hitting max_tokens
  const allComments: GeneratedComment[] = [];
  let remaining = options.comments;
  let batchNumber = 0;

  while (remaining > 0) {
    batchNumber++;
    const currentBatch = Math.min(remaining, batchSize);
    const batchOptions = { ...options, comments: currentBatch };
    options.onBatchProgress?.({
      phase: "start",
      batch: batchNumber,
      totalBatches,
      requested: currentBatch,
      generated: 0,
      totalGenerated: allComments.length,
      remaining,
    });
    const generatedBatch = await generateCommentBatch(
      client,
      dossier,
      vibePack,
      post,
      agenda,
      evidence,
      batchOptions,
      allComments,
    );
    const batch = normalizeBatchSize(generatedBatch, currentBatch, batchNumber, totalBatches);

    // Re-number IDs to be globally sequential
    const offset = allComments.length;
    const idMap = new Map<string, string>();
    for (const [index, comment] of batch.entries()) {
      const oldId = comment.id;
      const newId = `c${offset + index + 1}`;
      idMap.set(oldId, newId);
      comment.id = newId;
    }
    for (const comment of batch) {
      if (idMap.has(comment.parent_id)) {
        comment.parent_id = idMap.get(comment.parent_id)!;
      } else if (
        comment.parent_id !== "post" &&
        !allComments.some((c) => c.id === comment.parent_id)
      ) {
        // Parent from previous batch doesn't exist — make it top-level
        comment.parent_id = "post";
        comment.depth = 0;
      }
    }

    allComments.push(...batch);
    remaining = Math.max(0, remaining - batch.length);
    options.onBatchProgress?.({
      phase: "complete",
      batch: batchNumber,
      totalBatches,
      requested: currentBatch,
      generated: batch.length,
      totalGenerated: allComments.length,
      remaining,
    });
  }

  return allComments;
}

function normalizeBatchSize(
  batch: GeneratedComment[],
  expected: number,
  batchNumber: number,
  totalBatches: number,
): GeneratedComment[] {
  if (expected > 0 && batch.length === 0) {
    throw new Error(`AI returned no comments for batch ${batchNumber} of ${totalBatches}`);
  }
  if (batch.length < expected) {
    const noun = batch.length === 1 ? "comment" : "comments";
    throw new Error(
      `AI returned ${batch.length} ${noun} for batch ${batchNumber} of ${totalBatches}; expected exactly ${expected}`,
    );
  }
  return batch.slice(0, expected);
}

async function generateCommentBatch(
  client: AIClient,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  post: GeneratedPost,
  agenda: AgendaItem[],
  evidence: EvidencePack | null,
  options: CommentOptions,
  existingComments: GeneratedComment[],
): Promise<GeneratedComment[]> {
  const subreddit = vibePack.subreddit as string;
  const isFirstBatch = existingComments.length === 0;
  const startId = existingComments.length + 1;

  const continuationContext = isFirstBatch
    ? ""
    : `\n\nIMPORTANT: This is a CONTINUATION batch. ${existingComments.length} comments already exist.
- Start IDs at "c${startId}"
- You may create replies to existing comments by referencing their IDs
- Existing top-level comment summaries (for threading):
${existingComments
  .filter((c) => c.depth === 0)
  .slice(-10)
  .map((c) => `  ${c.id}: "${c.body_md.slice(0, 80)}..." by u/${c.author}`)
  .join("\n")}
- Cover agenda topics not yet well-represented
- Do NOT repeat points already made`;

  const system = `You are simulating Reddit comments for r/${subreddit}. Generate a realistic comment section for a project announcement post.

Requirements:
- Generate exactly ${options.comments} comments as a flat JSON array
- Each comment has: id, parent_id, author, author_flair, is_op, body_md, depth, is_deleted
- Top-level comments have parent_id = "post" and depth = 0
- Replies reference their parent's id and increment depth (max depth: ${options.maxDepth})
- Include up to ${isFirstBatch ? options.maxReplies : Math.min(2, options.maxReplies)} comments where is_op = true (the post author "${post.author}" replying to questions/feedback)
- Include 0-2 deleted comments (body_md = "[deleted]", author = "[deleted]", is_deleted = true)
- Include at least one mild argument thread (2-3 comments disagreeing with each other)
- Use realistic usernames that match r/${subreddit} culture
- Mix sentiment: supportive, skeptical, snarky, pedantic, helpful
- Follow the agenda for theme distribution
- Comment style: ${STYLE_DESCRIPTIONS[options.style] ?? options.style}
- Use sequential IDs starting at "c${startId}"
- When evidence is available, reference specific code patterns, file names, and technical details in comments
- Use evidence quotes naturally — as a redditor who actually looked at the repo

Subreddit vibe:
${JSON.stringify(vibePack, null, 2)}${continuationContext}

Return ONLY a valid JSON array.`;

  const userPrompt = `Post by u/${post.author}:
Title: ${post.title}

${post.body_md}

---

Agenda (theme distribution to follow):
${JSON.stringify(agenda, null, 2)}

---

Project details:
- Name: ${dossier.name}
- Description: ${dossier.description}
- Languages: ${dossier.languages.map((l) => `${l.name} (${l.pct}%)`).join(", ")}
- Stack: ${dossier.stack.join(", ")}
- Has tests: ${dossier.has_tests}
- License: ${dossier.license ?? "none detected"}${
    evidence
      ? `

---

Code evidence pack (use these to make comments specific and technically grounded):
${JSON.stringify(evidence, null, 2)}`
      : ""
  }`;

  const estimatedTokens = options.comments * 200;
  const maxTokens = options.maxTokens ?? Math.min(Math.max(16384, estimatedTokens), 64000);
  const batchOptions = { ...options, maxTokens };

  return generateJSON<GeneratedComment[]>(
    client,
    system,
    userPrompt,
    batchOptions,
    z.array(GeneratedCommentSchema),
  );
}
