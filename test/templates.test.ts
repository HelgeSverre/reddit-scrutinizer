import { describe, test, expect } from "bun:test";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "src", "ui", "templates");

const THEMES = ["reddit", "hackernews", "producthunt"] as const;

describe("UI templates", () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      test("template file exists and is valid HTML", async () => {
        const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
        expect(content).toContain("<!DOCTYPE html>");
        expect(content).toContain("</html>");
      });

      test("template fetches from /api/data", async () => {
        const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
        expect(content).toContain("/api/data");
      });

      test("template includes a SIMULATED badge", async () => {
        const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
        expect(content).toContain("SIMULATED");
      });

      test("template includes a disclaimer", async () => {
        const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
        expect(content).toContain("simulated");
      });
    });
  }
});
