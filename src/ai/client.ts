import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export interface GenerateOptions {
  model: string;
  temperature: number;
  maxTokens?: number;
}

export function createClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

export async function generateJSON<T>(
  client: Anthropic,
  system: string,
  userPrompt: string,
  options: GenerateOptions,
  schema?: z.ZodType<T>,
): Promise<T> {
  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const validate = (parsed: unknown): T => {
    if (schema) {
      return schema.parse(parsed);
    }
    return parsed as T;
  };

  // Try parsing as raw JSON first
  try {
    return validate(JSON.parse(text));
  } catch {
    // Try extracting from markdown fences
    const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (fenceMatch) {
      return validate(JSON.parse(fenceMatch[1]));
    }
    throw new Error(`Failed to parse JSON from response:\n${text.slice(0, 500)}`);
  }
}
