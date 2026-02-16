import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ProjectDossier } from "../scan/dossier";
import { generateJSON, type GenerateOptions } from "./client";
import type { GeneratedPost } from "./generate-post";

const AgendaItemSchema = z.object({
  topic: z.string(),
  stance: z.enum(["supportive", "skeptical", "hostile", "curious", "neutral"]),
  angle: z.string(),
  suggested_count: z.number(),
});

export interface AgendaItem {
  topic: string;
  stance: "supportive" | "skeptical" | "hostile" | "curious" | "neutral";
  angle: string;
  suggested_count: number;
}

export async function generateAgenda(
  client: Anthropic,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  post: GeneratedPost,
  options: GenerateOptions,
): Promise<AgendaItem[]> {
  const subreddit = vibePack.subreddit as string;

  const system = `You are an analyst predicting what r/${subreddit} would say about a project announcement post.

Generate 8-15 critique themes that represent the realistic spread of reactions this post would get.

Requirements:
- Mix of positive, negative, and neutral themes
- Consider the subreddit's pet topics and recurring debates
- Each theme should have a clear angle (what specifically they'd say)
- suggested_count indicates how many comments should cover this theme
- Ensure diversity: at least 2 supportive, 2 skeptical, and 1 curious theme

Subreddit vibe:
${JSON.stringify(vibePack, null, 2)}

Return ONLY a valid JSON array where each element has:
{
  "topic": "string (short theme label)",
  "stance": "supportive" | "skeptical" | "hostile" | "curious" | "neutral",
  "angle": "string (what they'd actually say)",
  "suggested_count": number
}`;

  const userPrompt = `Post title: ${post.title}

Post body:
${post.body_md}

Project dossier:
${JSON.stringify(dossier, null, 2)}`;

  return generateJSON<AgendaItem[]>(client, system, userPrompt, options, z.array(AgendaItemSchema));
}
