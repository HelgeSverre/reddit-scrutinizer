import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";
import { buildDossier } from "../../src/scan/dossier";

const fixturePath = resolve(import.meta.dir, "../fixtures/sample-project");

describe("buildDossier", () => {
  test("returns correct project name", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.name).toBe("sample-project");
  });

  test("returns description from package.json", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.description).toBe("A sample project for testing");
  });

  test("detects languages present", async () => {
    const dossier = await buildDossier(fixturePath);
    const names = dossier.languages.map((l) => l.name);
    expect(names).toContain("TypeScript");
  });

  test("detects license as MIT", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.license).toBe("MIT");
  });

  test("has_tests is true", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.has_tests).toBe(true);
  });

  test("readme is non-empty", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.readme.length).toBeGreaterThan(0);
  });

  test("file_tree is a non-empty string", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(typeof dossier.file_tree).toBe("string");
    expect(dossier.file_tree.length).toBeGreaterThan(0);
  });

  test("excerpts array is non-empty", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.excerpts.length).toBeGreaterThan(0);
  });

  test("stack includes Node.js and TypeScript", async () => {
    const dossier = await buildDossier(fixturePath);
    expect(dossier.stack).toContain("Node.js");
    expect(dossier.stack).toContain("TypeScript");
  });
});
