import { z } from "zod";
import type { ProjectDossier } from "../scan/dossier";
import { generateJSON, type AIClient, type GenerateOptions } from "./client";
import type { EvidencePack } from "./discover";
import type { GeneratedPost } from "./generate-post";

const STANCES = [
  "supportive",
  "skeptical",
  "hostile",
  "curious",
  "neutral",
  "snarky",
  "dismissive",
  "impressed",
] as const;

const AgendaItemSchema = z.object({
  topic: z.string(),
  stance: z.enum(STANCES),
  angle: z.string(),
  suggested_count: z.number(),
});

export type Stance = (typeof STANCES)[number];

export interface AgendaItem {
  topic: string;
  stance: Stance;
  angle: string;
  suggested_count: number;
}

export async function generateAgenda(
  client: AIClient,
  dossier: ProjectDossier,
  vibePack: Record<string, unknown>,
  post: GeneratedPost,
  evidence: EvidencePack | null,
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
- When code evidence is provided, ground your themes in the real observations found

Subreddit vibe:
${JSON.stringify(vibePack, null, 2)}

Return ONLY a valid JSON array where each element has:
{
  "topic": "string (short theme label)",
  "stance": ${STANCES.map((s) => `"${s}"`).join(" | ")},
  "angle": "string (what they'd actually say)",
  "suggested_count": number
}`;

  const userPrompt = `Post title: ${post.title}

Post body:
${post.body_md}

Project dossier:
${JSON.stringify(dossier, null, 2)}${
    evidence
      ? `

Code evidence (use these findings to ground your themes in real observations):
${JSON.stringify(evidence, null, 2)}`
      : ""
  }`;

  return generateJSON<AgendaItem[]>(client, system, userPrompt, options, z.array(AgendaItemSchema));
}
