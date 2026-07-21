import { describe, expect, test } from "bun:test";
import { zodSchema } from "ai";
import { z } from "zod";

describe("Zod through the AI SDK structured-output boundary", () => {
  test("converts a Zod schema to JSON schema", async () => {
    const schema = z.object({
      title: z.string(),
      tags: z.array(z.string()),
      flair: z.string().nullable(),
      count: z.number(),
      controversial: z.union([z.literal(0), z.literal(1)]),
    });

    const converted = zodSchema(schema);
    const json = await converted.jsonSchema;

    expect(json.type).toBe("object");
    expect(json.properties?.title).toMatchObject({ type: "string" });
    expect(json.properties?.tags).toMatchObject({ type: "array" });
    expect(json.properties?.count).toMatchObject({ type: "number" });
    expect(json.properties?.flair).toBeDefined();
  });
});
