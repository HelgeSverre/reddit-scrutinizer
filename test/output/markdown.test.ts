import { describe, test, expect } from "bun:test";
import { mdToHtml } from "../../src/output/markdown";

describe("mdToHtml", () => {
  test("converts **bold** to <strong>", () => {
    const html = mdToHtml("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  test("converts `code` to <code>", () => {
    const html = mdToHtml("`inline code`");
    expect(html).toContain("<code>inline code</code>");
  });

  test("converts links", () => {
    const html = mdToHtml("[example](https://example.com)");
    expect(html).toContain('<a href="https://example.com">example</a>');
  });

  test("handles empty string", () => {
    const html = mdToHtml("");
    expect(typeof html).toBe("string");
  });

  test("handles multiline markdown", () => {
    const md = "# Heading\n\nParagraph one.\n\nParagraph two.";
    const html = mdToHtml(md);
    expect(html).toContain("<h1>");
    expect(html).toContain("Heading");
    expect(html).toContain("<p>Paragraph one.</p>");
    expect(html).toContain("<p>Paragraph two.</p>");
  });

  test("renders single newlines as <br> with breaks enabled", () => {
    expect(mdToHtml("line one\nline two")).toContain("<br>");
  });

  test("renders fenced code blocks", () => {
    const html = mdToHtml("```\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
    expect(html).toContain("const x = 1;");
  });

  test("renders task-style lists via GFM", () => {
    const html = mdToHtml("- [x] done\n- [ ] todo");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
  });
});
