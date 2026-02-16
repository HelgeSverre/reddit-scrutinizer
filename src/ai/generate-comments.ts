import type Anthropic from "@anthropic-ai/sdk";
import type { ProjectDossier } from "../scan/dossier";
import { generateJSON, type GenerateOptions } from "./client";
import type { GeneratedPost } from "./generate-post";
import type { AgendaItem } from "./generate-agenda";

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

export interface CommentOptions extends GenerateOptions {
  comments: number;
  maxDepth: number;
  maxReplies: number;
  style: string;
}

export async function generateComments(
  client: Anthropic,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  post: GeneratedPost,
  agenda: AgendaItem[],
  options: CommentOptions,
): Promise<GeneratedComment[]> {
  const subreddit = vibePack.subreddit as string;

  const system = `You are simulating Reddit comments for r/${subreddit}. Generate a realistic comment section for a project announcement post.

Requirements:
- Generate exactly ${options.comments} comments as a flat JSON array
- Each comment has: id, parent_id, author, author_flair, is_op, body_md, depth, is_deleted
- Top-level comments have parent_id = "post" and depth = 0
- Replies reference their parent's id and increment depth (max depth: ${options.maxDepth})
- Include up to ${options.maxReplies} comments where is_op = true (the post author "${post.author}" replying to questions/feedback)
- Include 0-2 deleted comments (body_md = "[deleted]", author = "[deleted]", is_deleted = true)
- Include at least one mild argument thread (2-3 comments disagreeing with each other)
- Use realistic usernames that match r/${subreddit} culture
- Mix sentiment: supportive, skeptical, snarky, pedantic, helpful
- Follow the agenda for theme distribution
- Comment style: ${options.style}
- Use sequential IDs like "c1", "c2", "c3", etc.

Subreddit vibe:
${JSON.stringify(vibePack, null, 2)}

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
- License: ${dossier.license ?? "none detected"}`;

  return generateJSON<GeneratedComment[]>(client, system, userPrompt, options);
}
