import { describe, test, expect } from "bun:test";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

// The e2e test globally mocks the client module with mock.module, which
// persists across all test files in the same bun test run. To test the real
// generateJSON logic we inline the source function here so we can exercise
// the JSON-parsing and Zod-validation code paths without hitting the mock.

async function generateJSON<T>(
  client: Anthropic,
  system: string,
  userPrompt: string,
  options: { model: string; temperature: number; maxTokens?: number },
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

function makeFakeClient(responseText: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: responseText }],
      }),
    },
  } as any;
}

const defaultOptions = { model: "test", temperature: 0 };

describe("generateJSON", () => {
  test("parses raw JSON", async () => {
    const client = makeFakeClient('{"title":"hello"}');
    const result = await generateJSON(client, "", "", defaultOptions);
    expect(result).toEqual({ title: "hello" });
  });

  test("parses JSON in markdown fences", async () => {
    const client = makeFakeClient('```json\n{"title":"hello"}\n```');
    const result = await generateJSON(client, "", "", defaultOptions);
    expect(result).toEqual({ title: "hello" });
  });

  test("parses JSON in fences without language tag", async () => {
    const client = makeFakeClient('```\n{"title":"hello"}\n```');
    const result = await generateJSON(client, "", "", defaultOptions);
    expect(result).toEqual({ title: "hello" });
  });

  test("throws on invalid JSON", async () => {
    const client = makeFakeClient("not json at all");
    await expect(
      generateJSON(client, "", "", defaultOptions),
    ).rejects.toThrow("Failed to parse");
  });

  test("validates with Zod schema when provided", async () => {
    const schema = z.object({ title: z.string() });
    const client = makeFakeClient('{"title":"hello"}');
    const result = await generateJSON(client, "", "", defaultOptions, schema);
    expect(result).toEqual({ title: "hello" });
  });

  test("Zod validation rejects bad data", async () => {
    const schema = z.object({ title: z.string() });
    const client = makeFakeClient('{"title": 123}');
    await expect(
      generateJSON(client, "", "", defaultOptions, schema),
    ).rejects.toThrow();
  });
});
