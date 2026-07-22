import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { THEMES } from "../../src/cli";
import { parseScrutiny } from "../../src/output/export-html";
import { renderThemeDocument } from "../../src/ui/render";

const FIXTURE_JSON = join(import.meta.dir, "../fixtures/sample-scrutiny.json");
const doc = parseScrutiny(await readFile(FIXTURE_JSON, "utf-8"));
const firstAuthor = doc.simulation.comments[0]!.author;

describe("renderThemeDocument", () => {
  test.each([...THEMES])("%s: valid document with content baked in (no JS needed)", (theme) => {
    const html = renderThemeDocument(theme, doc);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<title>test-project — reddit-scrutinizer</title>");
    // A comment author is present directly in the static markup — no client render.
    expect(html).toContain(firstAuthor);
    expect(html).not.toContain("Loading");
  });

  test.each([...THEMES])("%s: rendering is deterministic", (theme) => {
    expect(renderThemeDocument(theme, doc)).toBe(renderThemeDocument(theme, doc));
  });

  test("rejects an unknown theme", () => {
    // @ts-expect-error intentionally passing an unknown theme
    expect(() => renderThemeDocument("myspace", doc)).toThrow("unknown theme");
  });

  test("escapes author-controlled text in the title", () => {
    const evil = structuredClone(doc);
    evil.project.name = "x</script><b>";
    const html = renderThemeDocument("reddit", evil);
    expect(html).toContain("&lt;/script>");
    expect(html).not.toContain("<title>x</script>");
  });

  test("bakes body_html so its markup renders (not escaped)", () => {
    const withStrong = structuredClone(doc);
    withStrong.simulation.post.body_html = "<p><strong>bold</strong> body</p>";
    const html = renderThemeDocument("reddit", withStrong);
    expect(html).toContain("<strong>bold</strong>");
  });
});

describe("stackoverflow theme", () => {
  const html = renderThemeDocument("stackoverflow", doc);
  const topLevel = doc.simulation.comments.filter((c) => c.parent_id === doc.simulation.post.id);

  test("renders the question title and answer count", () => {
    expect(html).toContain(doc.simulation.post.title);
    // fixture has one top-level comment → "1 Answer" (singular)
    expect(html).toContain(`${topLevel.length} Answer`);
  });

  test("marks exactly one accepted answer when answers exist", () => {
    // Match the rendered element's class attribute, not the CSS rule of the same name.
    const accepted = html.match(/class="accepted-check-label"/g) ?? [];
    expect(accepted.length).toBe(topLevel.length > 0 ? 1 : 0);
  });

  test("renders tags from the project stack and languages", () => {
    expect(html).toContain(">bun<");
    expect(html).toContain(">TypeScript<");
  });

  test("shows the closed-question banner", () => {
    expect(html).toContain("Closed.");
  });
});
