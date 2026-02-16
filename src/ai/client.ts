import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

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
  if (schema) {
    try {
      return await generateWithStructuredOutput(client, system, userPrompt, options, schema);
    } catch (err) {
      if (err instanceof Anthropic.BadRequestError && String(err.message).includes("does not support output format")) {
        // Model doesn't support structured outputs, fall through to prompt-based
      } else {
        throw err;
      }
    }
  }

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = extractText(response);

  const validate = (parsed: unknown): T => {
    if (schema) return schema.parse(parsed);
    return parsed as T;
  };

  try {
    return validate(JSON.parse(text));
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (fenceMatch) {
      return validate(JSON.parse(fenceMatch[1]));
    }
    throw new Error(`Failed to parse JSON from response:\n${text.slice(0, 500)}`);
  }
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function generateWithStructuredOutput<T>(
  client: Anthropic,
  system: string,
  userPrompt: string,
  options: GenerateOptions,
  schema: z.ZodType<T>,
): Promise<T> {
  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });

  const response = await client.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 8192,
    temperature: options.temperature,
    system,
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: {
        type: "json_schema",
        schema: jsonSchema as Record<string, unknown>,
      },
    },
  });

  return schema.parse(JSON.parse(extractText(response)));
}
