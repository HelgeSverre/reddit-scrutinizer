import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { detectLanguages, detectTests, detectLicense, detectStack } from "../../src/scan/detect";

const fixturePath = resolve(import.meta.dir, "../fixtures/sample-project");

describe("detectLanguages", () => {
  test("detects TypeScript from .ts files", () => {
    const files = [
      { path: "src/index.ts", size: 100 },
      { path: "src/app.ts", size: 200 },
    ];
    const result = detectLanguages(files);
    expect(result.find((l) => l.name === "TypeScript")).toBeDefined();
  });

  test("detects multiple languages", () => {
    const files = [
      { path: "src/index.ts", size: 100 },
      { path: "src/utils.py", size: 50 },
      { path: "src/main.go", size: 80 },
    ];
    const result = detectLanguages(files);
    const names = result.map((l) => l.name);
    expect(names).toContain("TypeScript");
    expect(names).toContain("Python");
    expect(names).toContain("Go");
  });

  test("returns percentages that sum to ~100", () => {
    const files = [
      { path: "a.ts", size: 10 },
      { path: "b.ts", size: 10 },
      { path: "c.py", size: 10 },
      { path: "d.go", size: 10 },
    ];
    const result = detectLanguages(files);
    const total = result.reduce((sum, l) => sum + l.pct, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  test("returns empty array for no files", () => {
    expect(detectLanguages([])).toEqual([]);
  });

  test("sorts by file count descending", () => {
    const files = [
      { path: "a.py", size: 10 },
      { path: "b.ts", size: 10 },
      { path: "c.ts", size: 10 },
      { path: "d.ts", size: 10 },
    ];
    const result = detectLanguages(files);
    expect(result.at(0)?.name).toBe("TypeScript");
    expect(result.at(1)?.name).toBe("Python");
  });
});

describe("detectTests", () => {
  test("returns true when files contain 'test' in path", () => {
    const files = [{ path: "src/app.test.ts", size: 50 }];
    expect(detectTests(files)).toBe(true);
  });

  test("returns true for 'spec' files", () => {
    const files = [{ path: "src/app.spec.ts", size: 50 }];
    expect(detectTests(files)).toBe(true);
  });

  test("returns true for '__tests__' directory", () => {
    const files = [{ path: "__tests__/app.ts", size: 50 }];
    expect(detectTests(files)).toBe(true);
  });

  test("returns false when no test files", () => {
    const files = [
      { path: "src/index.ts", size: 100 },
      { path: "src/utils.ts", size: 50 },
    ];
    expect(detectTests(files)).toBe(false);
  });
});

describe("detectLicense", () => {
  test("detects MIT from sample-project fixture", async () => {
    const result = await detectLicense(fixturePath);
    expect(result).toBe("MIT");
  });

  test("returns null for non-existent directory", async () => {
    const result = await detectLicense("/tmp/non-existent-dir-12345");
    expect(result).toBeNull();
  });
});

describe("detectStack", () => {
  test("detects Node.js from package.json", async () => {
    const result = await detectStack(fixturePath);
    expect(result).toContain("Node.js");
  });

  test("detects TypeScript from tsconfig.json", async () => {
    const result = await detectStack(fixturePath);
    expect(result).toContain("TypeScript");
  });

  test("detects Express from package.json dependencies", async () => {
    const result = await detectStack(fixturePath);
    expect(result).toContain("Express");
  });

  test("detects Jest from devDependencies", async () => {
    const result = await detectStack(fixturePath);
    expect(result).toContain("Jest");
  });
});
