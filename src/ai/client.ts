import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createAnthropic, type AnthropicProvider } from "@ai-sdk/anthropic";
import type { z } from "zod";

export const DEFAULT_MAX_TOKENS = 16384;

export interface GenerateOptions {
  model: string;
  temperature: number;
  maxTokens?: number;
}

export type AIClient = AnthropicProvider;

export function createClient(apiKey: string): AIClient {
  return createAnthropic({ apiKey });
}

export async function generateJSON<T>(
  client: AIClient,
  system: string,
  userPrompt: string,
  options: GenerateOptions,
  schema: z.ZodType<T>,
): Promise<T> {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  try {
    const result = await generateText({
      model: client(options.model),
      output: Output.object({ schema }),
      system,
      prompt: userPrompt,
      maxOutputTokens: maxTokens,
      temperature: options.temperature,
    });

    if (result.finishReason === "length") {
      throw new MaxTokensError(maxTokens);
    }

    return result.output;
  } catch (err) {
    if (err instanceof MaxTokensError) throw err;
    // Truncated responses fail JSON validation inside the AI SDK and surface
    // as NoObjectGeneratedError with finishReason "length".
    if (NoObjectGeneratedError.isInstance(err) && err.finishReason === "length") {
      throw new MaxTokensError(maxTokens);
    }
    throw err;
  }
}

export class MaxTokensError extends Error {
  constructor(public readonly limit: number) {
    super(`Response truncated: hit max_tokens limit of ${limit}`);
    this.name = "MaxTokensError";
  }
}
