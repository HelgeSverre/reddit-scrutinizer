import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { walkDirectory } from "../../src/scan/walk";

const fixturePath = resolve(import.meta.dir, "../fixtures/sample-project");

describe("walkDirectory", () => {
  test("returns files from the fixture directory", async () => {
    const result = await walkDirectory(fixturePath);
    expect(result.length).toBeGreaterThan(0);
  });

  test("excludes node_modules", async () => {
    const result = await walkDirectory(fixturePath);
    const hasNodeModules = result.some((e) => e.path.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
  });

  test("respects .gitignore patterns", async () => {
    const distDir = resolve(fixturePath, "dist");
    try {
      await mkdir(distDir, { recursive: true });
      await writeFile(resolve(distDir, "bundle.js"), "console.log('built')");
      const result = await walkDirectory(fixturePath);
      const hasDist = result.some((e) => e.path.startsWith("dist"));
      expect(hasDist).toBe(false);
    } finally {
      await rm(distDir, { recursive: true, force: true });
    }
  });

  test("each entry has path (relative) and size (number > 0)", async () => {
    const result = await walkDirectory(fixturePath);
    for (const entry of result) {
      expect(typeof entry.path).toBe("string");
      expect(entry.path).not.toMatch(/^\//);
      expect(typeof entry.size).toBe("number");
      expect(entry.size).toBeGreaterThan(0);
    }
  });

  test("results are sorted alphabetically", async () => {
    const result = await walkDirectory(fixturePath);
    const paths = result.map((e) => e.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  test("skips binary files", async () => {
    const pngPath = resolve(fixturePath, "image.png");
    try {
      await writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const result = await walkDirectory(fixturePath);
      const hasPng = result.some((e) => e.path === "image.png");
      expect(hasPng).toBe(false);
    } finally {
      await rm(pngPath, { force: true });
    }
  });

  test("maxFiles parameter limits results", async () => {
    const result = await walkDirectory(fixturePath, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  test("skips .lock files", async () => {
    const lockPath = resolve(fixturePath, "test.lock");
    try {
      await writeFile(lockPath, "lock contents");
      const result = await walkDirectory(fixturePath);
      const hasLock = result.some((e) => e.path === "test.lock");
      expect(hasLock).toBe(false);
    } finally {
      await rm(lockPath, { force: true });
    }
  });
});
