import type Anthropic from "@anthropic-ai/sdk";
import type { ProjectDossier } from "../scan/dossier";
import { generateJSON, type GenerateOptions } from "./client";

export interface GeneratedPost {
  title: string;
  body_md: string;
  author: string;
  author_flair: string | null;
  post_flair: string | null;
}

export async function generatePost(
  client: Anthropic,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  options: GenerateOptions,
): Promise<GeneratedPost> {
  const subreddit = vibePack.subreddit as string;

  const system = `You are a developer posting to r/${subreddit}. Write an authentic "I made this" / announcement post for a project.

Your post should:
- Explain what the project does and why you built it
- Highlight what's technically interesting about the implementation
- Invite feedback naturally — don't be desperate, don't beg for stars
- Match the culture and tone of r/${subreddit}
- Feel like a real human wrote it, not a marketing team

Subreddit vibe:
${JSON.stringify(vibePack, null, 2)}

Return ONLY valid JSON with this exact shape:
{
  "title": "string",
  "body_md": "string (markdown formatted post body)",
  "author": "string (realistic Reddit username)",
  "author_flair": "string or null",
  "post_flair": "string or null"
}`;

  const userPrompt = `Here is the project dossier:\n\n${JSON.stringify(dossier, null, 2)}`;

  return generateJSON<GeneratedPost>(client, system, userPrompt, options);
}
