import { mock } from "bun:test";

type GenerateTextOptions = Record<string, unknown>;
type GenerateTextHandler = (options: GenerateTextOptions) => unknown | Promise<unknown>;

let handler: GenerateTextHandler = () => {
  throw new Error("AI SDK mock handler was not configured");
};

export const generateTextCalls: GenerateTextOptions[] = [];

const noObjectGeneratedErrorMarker = Symbol.for("vercel.ai.error.AI_NoObjectGeneratedError");

export class FakeNoObjectGeneratedError extends Error {
  readonly [noObjectGeneratedErrorMarker] = true;

  constructor(
    message: string,
    public readonly finishReason?: string,
  ) {
    super(message);
    this.name = "AI_NoObjectGeneratedError";
  }

  static isInstance(error: unknown): error is FakeNoObjectGeneratedError {
    return error instanceof FakeNoObjectGeneratedError;
  }
}

export function setGenerateTextHandler(nextHandler: GenerateTextHandler): void {
  handler = nextHandler;
}

export function resetAISDKMock(): void {
  generateTextCalls.length = 0;
  handler = () => {
    throw new Error("AI SDK mock handler was not configured");
  };
}

mock.module("ai", () => ({
  generateText: async (options: GenerateTextOptions) => {
    generateTextCalls.push(options);
    return handler(options);
  },
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ type: "object", schema }),
  },
  NoObjectGeneratedError: FakeNoObjectGeneratedError,
}));
