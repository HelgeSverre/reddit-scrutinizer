import { describe, test, expect, beforeEach } from "bun:test";
import { z } from "zod";
import type { AIClient } from "../../src/ai/client";
import {
  FakeNoObjectGeneratedError,
  generateTextCalls,
  resetAISDKMock,
  setGenerateTextHandler,
} from "../fixtures/ai-sdk-mock";

const { generateJSON, MaxTokensError, DEFAULT_MAX_TOKENS } = await import("../../src/ai/client");

const fakeClient = ((modelId: string) => ({ modelId })) as AIClient;
const schema = z.object({ title: z.string() });
const defaultOptions = { model: "test-model", temperature: 0.8 };

function okResult(output: unknown, overrides: Record<string, unknown> = {}) {
  return { output, finishReason: "stop", warnings: undefined, ...overrides };
}

beforeEach(() => {
  resetAISDKMock();
});

describe("generateJSON", () => {
  test("passes model, output schema, prompts and settings to generateText", async () => {
    setGenerateTextHandler(() => okResult({ title: "hello" }));

    const result = await generateJSON(
      fakeClient,
      "system prompt",
      "user prompt",
      defaultOptions,
      schema,
    );

    expect(result).toEqual({ title: "hello" });
    expect(generateTextCalls).toHaveLength(1);
    const call = generateTextCalls.at(0);
    expect(call).toBeDefined();
    if (!call) throw new Error("generateText was not called");
    expect(call.model).toEqual({ modelId: "test-model" });
    expect(call.system).toBe("system prompt");
    expect(call.prompt).toBe("user prompt");
    expect(call.temperature).toBe(0.8);
    expect(call.maxOutputTokens).toBe(DEFAULT_MAX_TOKENS);
    const output = call.output as {
      name?: string;
      type?: string;
      schema?: unknown;
      responseFormat?: Promise<{ schema: { properties: { title: { type: string } } } }>;
    };
    expect(output.name ?? output.type).toBe("object");
    if (output.schema) {
      expect(output.schema).toBe(schema);
    } else {
      const responseFormat = await output.responseFormat;
      expect(responseFormat?.schema.properties.title.type).toBe("string");
    }
  });

  test("respects explicit maxTokens", async () => {
    setGenerateTextHandler(() => okResult({ title: "hello" }));

    await generateJSON(fakeClient, "", "", { ...defaultOptions, maxTokens: 1234 }, schema);

    expect(generateTextCalls.at(0)?.maxOutputTokens).toBe(1234);
  });

  test("throws MaxTokensError when finishReason is length", async () => {
    setGenerateTextHandler(() => okResult({ title: "hello" }, { finishReason: "length" }));

    await expect(generateJSON(fakeClient, "", "", defaultOptions, schema)).rejects.toThrow(
      MaxTokensError,
    );
  });

  test("maps NoObjectGeneratedError with finishReason length to MaxTokensError", async () => {
    setGenerateTextHandler(() => {
      throw new FakeNoObjectGeneratedError("truncated", "length");
    });

    await expect(generateJSON(fakeClient, "", "", defaultOptions, schema)).rejects.toThrow(
      MaxTokensError,
    );
  });

  test("rethrows NoObjectGeneratedError for non-length finish reasons", async () => {
    setGenerateTextHandler(() => {
      throw new FakeNoObjectGeneratedError("bad json", "stop");
    });

    await expect(generateJSON(fakeClient, "", "", defaultOptions, schema)).rejects.toThrow(
      FakeNoObjectGeneratedError,
    );
  });

  test("rethrows provider errors", async () => {
    setGenerateTextHandler(() => {
      throw new Error("api exploded");
    });

    await expect(generateJSON(fakeClient, "", "", defaultOptions, schema)).rejects.toThrow(
      "api exploded",
    );
  });

  test("does not duplicate warnings already logged by the AI SDK", async () => {
    const errors: string[] = [];
    const original = console.error;
    console.error = (msg: string) => errors.push(String(msg));
    try {
      setGenerateTextHandler(() =>
        okResult(
          { title: "hello" },
          {
            warnings: [
              { type: "unsupported", feature: "temperature", details: "temperature ignored" },
            ],
          },
        ),
      );

      await generateJSON(fakeClient, "", "", defaultOptions, schema);
    } finally {
      console.error = original;
    }

    expect(errors).toEqual([]);
  });
});
