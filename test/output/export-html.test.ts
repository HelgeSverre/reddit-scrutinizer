import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { THEMES } from "../../src/cli";
import {
  deriveOutputPaths,
  embedScriptSafeJson,
  ensureHtmlExtension,
  escapeTitle,
  exportForMainRun,
  exportFromDocument,
  htmlBaseFromJson,
  parseScrutiny,
  renderExportDocument,
  resolveThemes,
  runExportCommand,
} from "../../src/output/export-html";

const FIXTURE_JSON = join(import.meta.dir, "../fixtures/sample-scrutiny.json");
const fixtureText = await readFile(FIXTURE_JSON, "utf-8");
const fixtureDoc = parseScrutiny(fixtureText);

const tmpDirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rs-export-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (tmpDirs.length > 0) {
    await rm(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

function embeddedJsonOf(html: string): string {
  const marker = 'id="scrutiny-data" type="application/json">';
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf("</script>", start);
  return html.slice(start, end);
}

describe("theme and path resolution", () => {
  test("dedupes themes preserving first occurrence", () => {
    expect(resolveThemes(["reddit", "reddit", "qdb", "reddit"])).toEqual(["reddit", "qdb"]);
  });

  test("rejects unknown themes and empty input", () => {
    expect(() => resolveThemes(["nope"])).toThrow("unknown theme: nope");
    expect(() => resolveThemes([])).toThrow("at least one theme is required");
  });

  test("derives the HTML base from a JSON path", () => {
    expect(htmlBaseFromJson("/x/scrutiny.json")).toBe("/x/scrutiny.html");
    expect(htmlBaseFromJson("/x/reddit-scrutiny.json")).toBe("/x/reddit-scrutiny.html");
  });

  test("ensures an .html extension on --output", () => {
    expect(ensureHtmlExtension("/x/demo")).toBe("/x/demo.html");
    expect(ensureHtmlExtension("/x/demo.html")).toBe("/x/demo.html");
    expect(ensureHtmlExtension("/x/demo.HTML")).toBe("/x/demo.HTML");
  });

  test("names one theme unsuffixed and many themes suffixed", () => {
    expect(deriveOutputPaths("/x/scrutiny.html", ["reddit"])).toEqual([
      { theme: "reddit", path: "/x/scrutiny.html" },
    ]);
    expect(deriveOutputPaths("/x/scrutiny.html", ["reddit", "hackernews"])).toEqual([
      { theme: "reddit", path: "/x/scrutiny-reddit.html" },
      { theme: "hackernews", path: "/x/scrutiny-hackernews.html" },
    ]);
  });
});

describe("parsing", () => {
  test("rejects non-JSON input", () => {
    expect(() => parseScrutiny("not json")).toThrow("not valid JSON");
  });

  test("rejects JSON that does not match the schema", () => {
    expect(() => parseScrutiny(JSON.stringify({ schema_version: "1.0" }))).toThrow(
      "does not match the scrutiny schema",
    );
  });

  test("accepts a valid document", () => {
    expect(fixtureDoc.schema_version).toBe("1.0");
    expect(fixtureDoc.project.name).toBe("test-project");
  });
});

describe("script-safe embedding and titles", () => {
  test("escapes < U+2028 U+2029 and round-trips through JSON.parse", () => {
    const raw = JSON.stringify({ a: "</script><b>  " });
    const embedded = embedScriptSafeJson(raw);
    expect(embedded).not.toContain("</script>");
    expect(embedded).toContain("\\u003c");
    expect(embedded).toContain("\\u2028");
    expect(embedded).toContain("\\u2029");
    expect(JSON.parse(embedded)).toEqual({ a: "</script><b>  " });
  });

  test("HTML-escapes project names for the title", () => {
    expect(escapeTitle('A <b> & "q"')).toBe('A &lt;b&gt; &amp; "q"');
  });
});

describe("rendering", () => {
  test.each([...THEMES])("renders %s with the project title and embedded data", async (theme) => {
    const html = await renderExportDocument(theme, fixtureDoc);
    expect(html).toContain("<title>test-project — reddit-scrutinizer</title>");
    expect(html).toContain('<script id="scrutiny-data" type="application/json">');
    expect(html).toContain('document.getElementById("scrutiny-data")');
    expect(JSON.parse(embeddedJsonOf(html)).project.name).toBe("test-project");
    expect(html).toContain("</html>");
  });

  test("neutralizes </script> and escapes the title from project content", async () => {
    const doc = structuredClone(fixtureDoc);
    doc.project.name = "Owned</script><script>alert(1)</script>";
    doc.simulation.post.body_html = "<script>alert(2)</script> tail";
    const html = await renderExportDocument("reddit", doc);
    const embedded = embeddedJsonOf(html);
    expect(embedded).not.toContain("</script>");
    expect(html).toContain("&lt;/script&gt;");
    expect(JSON.parse(embedded).simulation.post.body_html).toBe("<script>alert(2)</script> tail");
  });
});

describe("writing", () => {
  test("exportFromDocument writes one unsuffixed file for one theme", async () => {
    const dir = await tmp();
    const written = await exportFromDocument(fixtureDoc, join(dir, "s.html"), ["reddit"]);
    expect(written).toEqual([join(dir, "s.html")]);
    const html = await readFile(join(dir, "s.html"), "utf-8");
    expect(html).toContain("<title>test-project — reddit-scrutinizer</title>");
  });

  test("exportFromDocument writes suffixed files for many themes", async () => {
    const dir = await tmp();
    const written = await exportFromDocument(fixtureDoc, join(dir, "s.html"), ["reddit", "qdb"]);
    expect(written).toEqual([join(dir, "s-reddit.html"), join(dir, "s-qdb.html")]);
    expect(await readFile(join(dir, "s-qdb.html"), "utf-8")).toContain("scrutiny-data");
  });

  test("exportForMainRun uses --theme when no export themes and replaces it otherwise", async () => {
    const dir = await tmp();
    const single = await exportForMainRun(fixtureDoc, join(dir, "out.json"), {
      theme: "hackernews",
      exportTheme: [],
    });
    expect(single).toEqual([join(dir, "out.html")]);
    const many = await exportForMainRun(fixtureDoc, join(dir, "out.json"), {
      theme: "hackernews",
      exportTheme: ["reddit", "qdb"],
    });
    expect(many).toEqual([join(dir, "out-reddit.html"), join(dir, "out-qdb.html")]);
  });

  test("runExportCommand derives from the input JSON and defaults to reddit", async () => {
    const dir = await tmp();
    const input = join(dir, "s.json");
    await writeFile(input, fixtureText, "utf-8");
    const written = await runExportCommand(input, { theme: [] });
    expect(written).toEqual([join(dir, "s.html")]);
  });

  test("runExportCommand honors --output and multiple themes", async () => {
    const dir = await tmp();
    const written = await runExportCommand(FIXTURE_JSON, {
      theme: ["reddit", "qdb"],
      output: join(dir, "demo"),
    });
    expect(written).toEqual([join(dir, "demo-reddit.html"), join(dir, "demo-qdb.html")]);
  });

  test("runExportCommand reports unreadable input", async () => {
    await expect(
      runExportCommand(join(await tmp(), "missing.json"), { theme: [] }),
    ).rejects.toThrow("cannot read input file");
  });
});

describe("offline safety", () => {
  test("the export module never imports the server or the browser opener", async () => {
    const src = await readFile(join(import.meta.dir, "../../src/output/export-html.ts"), "utf-8");
    expect(src).not.toContain("ui/server");
    expect(src).not.toContain('from "open"');
  });
});
