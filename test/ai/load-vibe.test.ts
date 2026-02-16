import { describe, test, expect } from "bun:test";
import { loadVibePack } from "../../src/ai/load-vibe";

const ALL_VIBES = [
  "cpp",
  "csharp",
  "devops",
  "experienceddevs",
  "gamedev",
  "golang",
  "haskell",
  "java",
  "javascript",
  "kotlin",
  "linux",
  "lisp",
  "localllama",
  "machinelearning",
  "php",
  "programming",
  "python",
  "reactjs",
  "rust",
  "selfhosted",
  "typescript",
  "webdev",
] as const;

describe("loadVibePack", () => {
  test("loading a known subreddit returns an object with subreddit, tone, archetypes", () => {
    const pack = loadVibePack("programming");
    expect(pack.subreddit).toBe("programming");
    expect(pack.tone).toBeArray();
    expect((pack.tone as string[]).length).toBeGreaterThan(0);
    expect(pack.archetypes).toBeArray();
    expect((pack.archetypes as unknown[]).length).toBeGreaterThan(0);
  });

  test("loading an unknown subreddit returns a fallback with default archetypes", () => {
    const pack = loadVibePack("nonexistent_sub_xyz");
    expect(pack.subreddit).toBe("nonexistent_sub_xyz");
    expect(pack.tone).toEqual(["casual", "technical", "opinionated"]);
    expect(pack.archetypes).toBeArray();

    const archetypes = pack.archetypes as { type: string }[];
    const types = archetypes.map((a) => a.type);
    expect(types).toContain("enthusiast");
    expect(types).toContain("skeptic");
    expect(types).toContain("helper");
    expect(types).toContain("lurker-commenter");
    expect(types).toContain("troll");
  });

  describe("all 22 built-in vibe packs load without error", () => {
    for (const sub of ALL_VIBES) {
      test(`loads "${sub}" successfully`, () => {
        expect(() => loadVibePack(sub)).not.toThrow();
      });
    }
  });

  describe("each loaded pack has required fields", () => {
    for (const sub of ALL_VIBES) {
      test(`"${sub}" has subreddit, tone, and archetypes`, () => {
        const pack = loadVibePack(sub);
        expect((pack.subreddit as string).toLowerCase()).toBe(sub);
        expect(pack.tone).toBeArray();
        expect(pack.archetypes).toBeArray();
        expect((pack.archetypes as unknown[]).length).toBeGreaterThan(0);
      });
    }
  });
});
