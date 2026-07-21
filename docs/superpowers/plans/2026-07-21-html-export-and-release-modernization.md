# Self-contained HTML Export and 0.6.0 Release Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users export any scrutiny as a self-contained, offline HTML file (no server), give every served and exported UI a project-specific browser title, and finish the 0.6.0 release on current dependencies and CI actions.

**Architecture:** A focused `src/output/export-html.ts` module owns parse/validate → theme+path resolution → template render (embedded script-safe data + project title) → atomic write, and is reused by both the main command's `--export-html` flag and a new `export <file>` subcommand. The six existing templates gain a shared data loader that prefers an embedded `<script id="scrutiny-data" type="application/json">` and falls back to `/api/data`, so one template set serves both offline files and the live server. Dependencies (commander, marked, zod, typescript) and GitHub Actions are bumped to current majors with a package-smoke matrix.

**Tech Stack:** Bun, strict TypeScript, Commander, Bun Test, Oxfmt, Oxlint, marked, zod, Vercel AI SDK (Anthropic).

## Global Constraints

- Work directly on the current `main` worktree; do not create branches, worktrees, tags, or sub-agents. Do not publish or tag 0.6.0.
- Themes are exactly `THEMES = ["reddit", "hackernews", "producthunt", "twitter", "bluesky", "qdb"]` (order preserved). `reddit` is the default.
- Browser title after data is available is exactly `` `${project.name} — reddit-scrutinizer` `` (em dash `—`, U+2014). Loading/error fallback title is `reddit-scrutinizer`.
- `--export-theme` is repeatable, valid only with `--export-html`, replaces (not adds to) the `--theme` default, and collapses duplicates preserving first occurrence.
- `export <file>` accepts repeatable `--theme` (default `reddit`) and `-o, --output <file>`; it NEVER starts a server or opens a browser.
- One theme → unsuffixed HTML name; multiple themes → every output suffixed `-<theme>`. An `--output`/`-o` value without a `.html` extension receives one.
- Embedded JSON is script-safe: escape `<` → `<`, U+2028 → ` `, U+2029 → ` `. Project names are HTML-escaped (`&`, `<`, `>`) before insertion into `<title>`.
- Exported pages make no network requests; all CSS, JS, and data live in one document.
- No sanitization of `body_html` is added (non-goal). Treat local scrutiny JSON as trusted input, documented with a warning.
- Never log API keys, prompts, snippets, or raw model responses. Main-command progress reports HTML export paths without dumping the document or embedded data.
- Each file write is atomic (temp file + rename). All JSON, themes, paths, and rendered documents are prepared before the first final output is written.
- Do not change JSON `schema_version` `"1.0"`. Do not add HTML sanitization, export retries, or export archives.
- Update `CHANGELOG.md` as behavior changes land; historical entries are not rewritten.
- The full `bun run check` (format, lint, `tsc --noEmit`, isolated tests, coverage) must pass.

---

### Task 1: Templates — project titles and offline data loader

Give all six templates (1) a normalized `<title>reddit-scrutinizer</title>` fallback anchor, (2) a shared `loadScrutinyData()` that prefers embedded JSON and falls back to `/api/data`, and (3) a `document.title` set from the loaded project name. The served UI is unchanged in behavior; this enables the exporter (Task 2) to inject data and a title.

**Files:**

- Modify: `src/ui/templates/reddit.html`
- Modify: `src/ui/templates/hackernews.html`
- Modify: `src/ui/templates/producthunt.html`
- Modify: `src/ui/templates/twitter.html`
- Modify: `src/ui/templates/bluesky.html`
- Modify: `src/ui/templates/qdb.html`
- Modify: `test/templates.test.ts`

**Interfaces:**

- Produces (per template): a `<title>reddit-scrutinizer</title>` anchor, an `async function loadScrutinyData()` that returns the parsed scrutiny document, and a `document.title` assignment after data loads.
- Consumes: nothing new. Each template already has `let DATA = null;` and a three-line `/api/data` fetch block that are byte-identical across all six.

- [ ] **Step 1: Write failing template assertions**

In `test/templates.test.ts`, add three assertions inside the existing `for (const theme of THEMES)` `describe(theme, ...)` block, after the existing `template includes a disclaimer` test:

```ts
test("template falls back to the reddit-scrutinizer title", async () => {
  const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
  expect(content).toContain("<title>reddit-scrutinizer</title>");
});

test("template prefers embedded data then sets the document title", async () => {
  const content = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
  expect(content).toContain('document.getElementById("scrutiny-data")');
  expect(content).toContain("document.title");
  expect(content).toContain("/api/data");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `bun test --isolate test/templates.test.ts`

Expected: FAIL for `hackernews`, `producthunt`, `twitter`, `bluesky`, and `qdb` (non-`reddit` titles, no `scrutiny-data`, no `document.title`).

- [ ] **Step 3: Normalize the `<title>` in each template**

Apply exactly one title replacement per template (the `reddit` template already matches and needs no change):

- `src/ui/templates/hackernews.html`: replace `<title>Hacker News</title>` with `<title>reddit-scrutinizer</title>`
- `src/ui/templates/producthunt.html`: replace `<title>Product Hunt — reddit-scrutinizer</title>` with `<title>reddit-scrutinizer</title>`
- `src/ui/templates/twitter.html`: replace `<title>X — reddit-scrutinizer</title>` with `<title>reddit-scrutinizer</title>`
- `src/ui/templates/bluesky.html`: replace `<title>Bluesky — reddit-scrutinizer</title>` with `<title>reddit-scrutinizer</title>`
- `src/ui/templates/qdb.html`: replace `<title>QDB: Quote Database</title>` with `<title>reddit-scrutinizer</title>`

- [ ] **Step 4: Add the shared loader after `let DATA = null;` in every template**

In each of the six templates, replace the line (6-space indent, byte-identical across all six):

```
      let DATA = null;
```

with:

```
      let DATA = null;

      async function loadScrutinyData() {
        const embedded = document.getElementById("scrutiny-data");
        if (embedded) return JSON.parse(embedded.textContent);
        const res = await fetch("/api/data");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }
```

- [ ] **Step 5: Route data through the loader and set the title in every template**

In each of the six templates, replace the three-line fetch block (10-space indent, byte-identical across all six):

```
          const res = await fetch("/api/data");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          DATA = await res.json();
```

with:

```
          DATA = await loadScrutinyData();
          document.title = `${DATA.project.name} — reddit-scrutinizer`;
```

The existing `render();` call on the next line is unchanged.

- [ ] **Step 6: Verify template and server tests pass**

Run: `bun test --isolate test/templates.test.ts test/server.test.ts`

Expected: PASS. `test/server.test.ts` still passes because `Hacker News` and `Product Hunt` remain in each template's header outside the title.

- [ ] **Step 7: Commit template changes**

```bash
git add src/ui/templates test/templates.test.ts
git commit -m "feat: templates support embedded data and project titles"
```

---

### Task 2: Self-contained HTML export module

Create the focused output module that parses/validates a scrutiny document, resolves themes and output paths, renders a template with embedded script-safe data and a project-specific title, and writes each file atomically. No CLI wiring yet.

**Files:**

- Create: `src/output/export-html.ts`
- Modify: `src/cli.ts` (add `export type Theme` only)
- Create: `test/output/export-html.test.ts`

**Interfaces:**

- Consumes: `ScrutinyOutputSchema`, `ScrutinyOutput` from `src/output/schema.ts`; `THEMES`, `Theme` from `src/cli.ts`; the six `src/ui/templates/*.html` normalized in Task 1.
- Produces:
  - `parseScrutiny(jsonText: string): ScrutinyOutput`
  - `resolveThemes(themes: string[]): Theme[]`
  - `htmlBaseFromJson(jsonPath: string): string`
  - `ensureHtmlExtension(output: string): string`
  - `deriveOutputPaths(baseHtmlPath: string, themes: Theme[]): { theme: Theme; path: string }[]`
  - `escapeTitle(name: string): string`
  - `embedScriptSafeJson(json: string): string`
  - `renderExportDocument(theme: Theme, doc: ScrutinyOutput): Promise<string>`
  - `exportFromDocument(doc: ScrutinyOutput, baseHtmlPath: string, themes: Theme[]): Promise<string[]>`
  - `exportForMainRun(doc: ScrutinyOutput, jsonPath: string, options: { theme: string; exportTheme: string[] }): Promise<string[]>`
  - `runExportCommand(file: string, options: ExportOptions): Promise<string[]>`
  - `interface ExportOptions { theme: string[]; output?: string }`

- [ ] **Step 1: Add the `Theme` type to `src/cli.ts`**

Directly under the existing `export const THEMES = [...] as const;` line, add:

```ts
export type Theme = (typeof THEMES)[number];
```

- [ ] **Step 2: Write the failing export-module tests**

Create `test/output/export-html.test.ts`:

```ts
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
    doc.simulation.post.body_html = "<script>alert(2)</script> tail";
    const html = await renderExportDocument("reddit", doc);
    const embedded = embeddedJsonOf(html);
    expect(embedded).not.toContain("</script>");
    expect(html).toContain("&lt;/script&gt;");
    expect(JSON.parse(embedded).simulation.post.body_html).toBe("<script>alert(2)</script> tail");
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
```

- [ ] **Step 3: Verify the tests fail because the module does not exist**

Run: `bun test --isolate test/output/export-html.test.ts`

Expected: FAIL to resolve `../../src/output/export-html`.

- [ ] **Step 4: Implement `src/output/export-html.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { THEMES, type Theme } from "../cli";
import { ScrutinyOutputSchema, type ScrutinyOutput } from "./schema";

const TEMPLATES_DIR = join(import.meta.dir, "..", "ui", "templates");

export interface ExportOptions {
  theme: string[];
  output?: string;
}

export function parseScrutiny(jsonText: string): ScrutinyOutput {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("input is not valid JSON");
  }
  const result = ScrutinyOutputSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at ${issue.path.join(".")}` : "";
    throw new Error(
      `input does not match the scrutiny schema${where}: ${issue?.message ?? "unknown error"}`,
    );
  }
  return result.data;
}

export function resolveThemes(themes: string[]): Theme[] {
  const known = new Set<string>(THEMES);
  const seen = new Set<string>();
  const resolved: Theme[] = [];
  for (const theme of themes) {
    if (!known.has(theme)) {
      throw new Error(`unknown theme: ${theme} (choose from ${THEMES.join(", ")})`);
    }
    if (!seen.has(theme)) {
      seen.add(theme);
      resolved.push(theme as Theme);
    }
  }
  if (resolved.length === 0) {
    throw new Error("at least one theme is required");
  }
  return resolved;
}

export function htmlBaseFromJson(jsonPath: string): string {
  const ext = extname(jsonPath);
  const base = ext ? jsonPath.slice(0, -ext.length) : jsonPath;
  return `${base}.html`;
}

export function ensureHtmlExtension(output: string): string {
  return output.toLowerCase().endsWith(".html") ? output : `${output}.html`;
}

export function deriveOutputPaths(
  baseHtmlPath: string,
  themes: Theme[],
): { theme: Theme; path: string }[] {
  const dir = dirname(baseHtmlPath);
  const stem = basename(baseHtmlPath).replace(/\.html$/i, "");
  if (themes.length === 1) {
    return [{ theme: themes[0]!, path: join(dir, `${stem}.html`) }];
  }
  return themes.map((theme) => ({ theme, path: join(dir, `${stem}-${theme}.html`) }));
}

export function escapeTitle(name: string): string {
  return name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function embedScriptSafeJson(json: string): string {
  return json.replaceAll("<", "\\u003c").replaceAll(" ", "\\u2028").replaceAll(" ", "\\u2029");
}

export async function renderExportDocument(theme: Theme, doc: ScrutinyOutput): Promise<string> {
  const template = await readFile(join(TEMPLATES_DIR, `${theme}.html`), "utf-8");
  if (!template.includes("<title>reddit-scrutinizer</title>")) {
    throw new Error(`template ${theme} is missing the expected title anchor`);
  }
  const title = `${escapeTitle(doc.project.name)} — reddit-scrutinizer`;
  const dataScript = `<script id="scrutiny-data" type="application/json">${embedScriptSafeJson(
    JSON.stringify(doc),
  )}</script>\n  </head>`;
  return template
    .replace("<title>reddit-scrutinizer</title>", `<title>${title}</title>`)
    .replace("</head>", dataScript);
}

async function writeHtmlAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, contents, "utf-8");
  await rename(tempPath, path);
}

export async function exportFromDocument(
  doc: ScrutinyOutput,
  baseHtmlPath: string,
  themes: Theme[],
): Promise<string[]> {
  const targets = deriveOutputPaths(baseHtmlPath, themes);
  const rendered = await Promise.all(
    targets.map(async (target) => ({
      path: target.path,
      html: await renderExportDocument(target.theme, doc),
    })),
  );
  const written: string[] = [];
  for (const document of rendered) {
    await writeHtmlAtomic(document.path, document.html);
    written.push(document.path);
  }
  return written;
}

export async function exportForMainRun(
  doc: ScrutinyOutput,
  jsonPath: string,
  options: { theme: string; exportTheme: string[] },
): Promise<string[]> {
  const requested = options.exportTheme.length > 0 ? options.exportTheme : [options.theme];
  return exportFromDocument(doc, htmlBaseFromJson(jsonPath), resolveThemes(requested));
}

export async function runExportCommand(file: string, options: ExportOptions): Promise<string[]> {
  const inputPath = resolve(file);
  let jsonText: string;
  try {
    jsonText = await readFile(inputPath, "utf-8");
  } catch {
    throw new Error(`cannot read input file: ${inputPath}`);
  }
  const doc = parseScrutiny(jsonText);
  const themes = resolveThemes(options.theme.length > 0 ? options.theme : ["reddit"]);
  const baseHtmlPath = options.output
    ? ensureHtmlExtension(resolve(options.output))
    : htmlBaseFromJson(inputPath);
  return exportFromDocument(doc, baseHtmlPath, themes);
}
```

- [ ] **Step 5: Verify the export-module tests pass**

Run: `bun test --isolate test/output/export-html.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the export module**

```bash
git add src/output/export-html.ts src/cli.ts test/output/export-html.test.ts
git commit -m "feat: add self-contained HTML export module"
```

---

### Task 3: Main-command `--export-html` and `--export-theme`

Wire the main command to export HTML after writing JSON, before optionally starting the server, independent of `--open`. Add the repeatable, choices-validated `--export-theme`, reject it without `--export-html`, and report written paths.

**Files:**

- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Modify: `test/cli.test.ts`

**Interfaces:**

- Consumes: `exportForMainRun` from `src/output/export-html.ts`; `THEMES` from `src/cli.ts`.
- Produces:
  - `MainOptions` gains `exportHtml: boolean` and `exportTheme: string[]`.
  - `collectTheme(value: string, previous: string[]): string[]` (module-private in `src/cli.ts`).
  - `assertMainExportOptions(options: Pick<MainOptions, "exportHtml" | "exportTheme">): void` (exported from `src/cli.ts`).

- [ ] **Step 1: Write failing CLI tests for the new main options**

In `test/cli.test.ts`, add to the `describe("CLI option parsing", ...)` block:

```ts
test("defaults export options off", () => {
  const { options } = parseMain(["./project"]);
  expect(options.exportHtml).toBe(false);
  expect(options.exportTheme).toEqual([]);
});

test("collects repeatable --export-theme values", () => {
  const { options } = parseMain([
    "./project",
    "--export-html",
    "--export-theme",
    "reddit",
    "--export-theme",
    "hackernews",
  ]);
  expect(options.exportHtml).toBe(true);
  expect(options.exportTheme).toEqual(["reddit", "hackernews"]);
});

test("rejects an unknown --export-theme", () => {
  expect(() => parseMain(["./project", "--export-html", "--export-theme", "myspace"])).toThrow();
});

test("rejects --export-theme without --export-html", () => {
  expect(() => parseMain(["./project", "--export-theme", "reddit"])).toThrow(
    "--export-theme requires --export-html",
  );
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `bun test --isolate test/cli.test.ts`

Expected: FAIL — `exportHtml`/`exportTheme` are undefined and the guard does not exist.

- [ ] **Step 3: Add the collector, options, validation, and type to `src/cli.ts`**

Add `exportHtml: boolean;` and `exportTheme: string[];` to the `MainOptions` interface.

Add a module-private collector near the other parsers (after `parseTemperature`):

```ts
function collectTheme(value: string, previous: string[]): string[] {
  if (!(THEMES as readonly string[]).includes(value)) {
    throw new InvalidArgumentError(`Allowed choices are ${THEMES.join(", ")}.`);
  }
  return previous.concat(value);
}
```

Add the exported guard (place it above `createProgram`):

```ts
export function assertMainExportOptions(
  options: Pick<MainOptions, "exportHtml" | "exportTheme">,
): void {
  if (options.exportTheme.length > 0 && !options.exportHtml) {
    throw new Error("--export-theme requires --export-html");
  }
}
```

In `createProgram`, add the two options to the main command's option chain (after the existing `.option("--verbose", ...)`):

```ts
    .option("--export-html", "also write a self-contained HTML file next to the JSON", false)
    .addOption(
      new Option("--export-theme <name>", "HTML export theme; repeatable (requires --export-html)")
        .choices(THEMES)
        .argParser(collectTheme)
        .default([]),
    );
```

Change the injected-handler action so it validates before running:

```ts
if (handlers.run) {
  program.action((path: string, options: MainOptions) => {
    assertMainExportOptions(options);
    return handlers.run!(path, options);
  });
}
```

- [ ] **Step 4: Wire the main run in `src/index.ts`**

Update the import from `./cli` to include the guard:

```ts
import { program, type MainOptions, assertMainExportOptions } from "./cli";
```

Change the default action near the bottom of `src/index.ts` to validate first:

```ts
program.action(async (path: string, options: MainOptions) => {
  assertMainExportOptions(options);
  await run(path, options);
});
```

Inside `run`, immediately after the `outputStage.detail(\`Output: ...\`)`line and before the`let actualPort`/`if (options.open)` block, add:

```ts
if (options.exportHtml) {
  const { exportForMainRun } = await import("./output/export-html");
  const htmlPaths = await exportForMainRun(output, outPath, options);
  for (const htmlPath of htmlPaths) {
    progress.success(`HTML written to ${htmlPath}`);
  }
}
```

- [ ] **Step 5: Verify CLI and typecheck pass**

Run:

```bash
bun test --isolate test/cli.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit main-command export**

```bash
git add src/cli.ts src/index.ts test/cli.test.ts
git commit -m "feat: add --export-html to the main command"
```

---

### Task 4: `export <file>` subcommand and completion coverage

Add the `export <file>` subcommand that renders HTML from an existing scrutiny JSON file (never serving or opening), prints every written path, and flows into the generated shell completions. Update completion tests for the new subcommand.

**Files:**

- Modify: `src/cli.ts`
- Modify: `src/completions/model.ts`
- Modify: `test/cli.test.ts`
- Modify: `test/completions.test.ts`
- Create: `test/export-command.test.ts`

**Interfaces:**

- Consumes: `runExportCommand`, `ExportOptions` from `src/output/export-html.ts`; `collectTheme` from Task 3.
- Produces:
  - `ExportOptions` re-used as the subcommand option type; `ProgramHandlers` gains `exportFile?: (file: string, options: ExportOptions) => void | Promise<void>`.
  - The completion model exposes an `export` subcommand (`<file>` → `file` kind) with `--theme` (choices) and `-o, --output` (file kind). Subcommand order becomes `["serve", "export", "completions"]`.

- [ ] **Step 1: Write failing subcommand parsing and completion tests**

In `test/cli.test.ts`, add a `parseExport` helper (mirroring `parseServe`) and tests. Import `ExportOptions`:

```ts
import { createProgram, type ExportOptions, type MainOptions, type ServeOptions } from "../src/cli";
```

```ts
function parseExport(args: string[]): { file: string; options: ExportOptions } {
  let capture: { file: string; options: ExportOptions } | undefined;
  const program = quiet(
    createProgram({
      exportFile: (file, options) => {
        capture = { file, options };
      },
    }),
  );
  program.parse(["node", "reddit-scrutinizer", "export", ...args]);
  expect(capture).toBeDefined();
  return capture!;
}
```

```ts
test("parses export defaults, repeatable themes, and output", () => {
  expect(parseExport(["data.json"]).options).toMatchObject({ theme: [] });
  const custom = parseExport([
    "data.json",
    "--theme",
    "reddit",
    "--theme",
    "qdb",
    "-o",
    "demo.html",
  ]);
  expect(custom.file).toBe("data.json");
  expect(custom.options.theme).toEqual(["reddit", "qdb"]);
  expect(custom.options.output).toBe("demo.html");
});

test("rejects an unknown export --theme", () => {
  expect(() => parseExport(["data.json", "--theme", "myspace"])).toThrow();
});
```

In `test/completions.test.ts`, change the model subcommand expectation and the two Fish scoping assertions, and add export coverage. Replace:

```ts
expect(model.subcommands.map((command) => command.name)).toEqual(["serve", "completions"]);
```

with:

```ts
expect(model.subcommands.map((command) => command.name)).toEqual([
  "serve",
  "export",
  "completions",
]);
```

Add to the `provides path and choice hints` test:

```ts
expect(model.subcommands.find((command) => command.name === "export")?.arguments.at(0)?.kind).toBe(
  "file",
);
expect(
  model.subcommands
    .find((command) => command.name === "export")
    ?.options.find((o) => o.long === "--theme")?.choices,
).toContain("qdb");
expect(model.options.find((option) => option.long === "--export-theme")?.choices).toContain(
  "reddit",
);
```

Add `"export"` to the shared `for (const expected of [...])` list in the per-shell render test.

Replace the Fish scoping assertions:

```ts
expect(output).toContain(
  "__fish_reddit_scrutinizer_accepts_positional; and not __fish_seen_subcommand_from serve completions",
);
```

with:

```ts
expect(output).toContain(
  "__fish_reddit_scrutinizer_accepts_positional; and not __fish_seen_subcommand_from serve export completions",
);
```

and:

```ts
expect(output).toContain("-n 'not __fish_seen_subcommand_from serve completions' -l comments");
```

with:

```ts
expect(output).toContain(
  "-n 'not __fish_seen_subcommand_from serve export completions' -l comments",
);
```

- [ ] **Step 2: Write the failing export-command integration test**

Create `test/export-command.test.ts`:

```ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProgram } from "../src/cli";

const FIXTURE_JSON = join(import.meta.dir, "fixtures/sample-scrutiny.json");
const fixtureText = await readFile(FIXTURE_JSON, "utf-8");

const tmpDirs: string[] = [];
async function tmp(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rs-export-cmd-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(async () => {
  while (tmpDirs.length > 0) {
    await rm(tmpDirs.pop()!, { recursive: true, force: true });
  }
});

describe("export subcommand", () => {
  test("writes files and prints every written path without serving", async () => {
    const dir = await tmp();
    const input = join(dir, "s.json");
    await writeFile(input, fixtureText, "utf-8");

    const printed: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    // @ts-expect-error test spy
    process.stdout.write = (chunk: string) => {
      printed.push(String(chunk));
      return true;
    };
    try {
      await createProgram().parseAsync([
        "node",
        "reddit-scrutinizer",
        "export",
        input,
        "--theme",
        "reddit",
        "--theme",
        "qdb",
      ]);
    } finally {
      process.stdout.write = original;
    }

    const output = printed.join("");
    expect(output).toContain(join(dir, "s-reddit.html"));
    expect(output).toContain(join(dir, "s-qdb.html"));
    expect(await readFile(join(dir, "s-reddit.html"), "utf-8")).toContain(
      "<title>test-project — reddit-scrutinizer</title>",
    );
  });
});
```

- [ ] **Step 3: Verify the new tests fail**

Run: `bun test --isolate test/cli.test.ts test/completions.test.ts test/export-command.test.ts`

Expected: FAIL — no `export` subcommand, `ExportOptions` not exported, model/Fish assertions mismatch.

- [ ] **Step 4: Add the `export` subcommand to `src/cli.ts`**

Import `ExportOptions` for local use and re-export it for tests. At the top of `src/cli.ts`, add:

```ts
import type { ExportOptions } from "./output/export-html";
```

Then re-export the local binding (near the `MainOptions`/`ServeOptions` exports). With `verbatimModuleSyntax`, use the `type` modifier:

```ts
export type { ExportOptions };
```

The `import type` is fully erased at runtime, so `src/cli.ts` gains no runtime dependency on `export-html.ts`; the value import of `runExportCommand` stays dynamic inside the action, avoiding an import cycle.

Add `exportFile` to `ProgramHandlers`:

```ts
interface ProgramHandlers {
  run?: (path: string, options: MainOptions) => void | Promise<void>;
  serve?: (file: string, options: ServeOptions) => void | Promise<void>;
  exportFile?: (file: string, options: ExportOptions) => void | Promise<void>;
  completions?: (shell: Shell) => void | Promise<void>;
}
```

In `createProgram`, insert the `export` command block AFTER the `serveCommand.action(...)` block and BEFORE the `completions` command block (so subcommand order is serve, export, completions):

```ts
const exportCommand = program
  .command("export <file>")
  .description("write a self-contained HTML file from an existing scrutiny JSON file")
  .addOption(
    new Option("--theme <name>", "HTML export theme; repeatable")
      .choices(THEMES)
      .argParser(collectTheme)
      .default([]),
  )
  .option("-o, --output <file>", "output HTML path (base name when multiple themes)");

exportCommand.action(async (file: string, options: ExportOptions) => {
  if (handlers.exportFile) {
    await handlers.exportFile(file, options);
    return;
  }
  const { runExportCommand } = await import("./output/export-html");
  const written = await runExportCommand(file, options);
  for (const path of written) {
    process.stdout.write(`${path}\n`);
  }
});
```

Add an `export` example to the `addHelpText("after", ...)` block:

```ts
  $ reddit-scrutinizer export ./reddit-scrutiny.json --theme reddit --theme qdb
```

- [ ] **Step 5: Mark `--output` as a file completion in `src/completions/model.ts`**

In `optionMeta`, change the `--out` file-kind line to also cover `--output`:

```ts
if (option.long === "--out" || option.long === "--output") kind = "file";
```

- [ ] **Step 6: Verify subcommand, completion, and Bash-syntax checks pass**

Run:

```bash
bun test --isolate test/cli.test.ts test/completions.test.ts test/export-command.test.ts
bun run src/index.ts completions bash | bash -n
```

Expected: all tests PASS and `bash -n` exits 0.

- [ ] **Step 7: Commit the export subcommand and completions**

```bash
git add src/cli.ts src/completions/model.ts test/cli.test.ts test/completions.test.ts test/export-command.test.ts
git commit -m "feat: add export subcommand with completion coverage"
```

---

### Task 5: Dependency upgrades (commander, marked, zod, typescript)

Bump the four dependencies to their target majors, regenerate the Bun lockfile, keep current APIs unless the upgrade forces a change, and add regression tests for Marked output and the real Zod-through-AI-SDK conversion boundary.

**Files:**

- Modify: `package.json`
- Modify: `bun.lock` (regenerated, not hand-edited)
- Modify: `test/output/markdown.test.ts`
- Create: `test/ai/zod-schema.test.ts`

**Interfaces:**

- Consumes: `mdToHtml` from `src/output/markdown.ts`; `zodSchema` from `ai`; `z` from `zod`.
- Produces: no API changes to source; only version bumps plus regression coverage.

- [ ] **Step 1: Write the failing Marked regression cases**

Add to `test/output/markdown.test.ts`:

````ts
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
````

- [ ] **Step 2: Write the failing Zod-through-AI-SDK boundary test**

Create `test/ai/zod-schema.test.ts` (this file does NOT import `test/fixtures/ai-sdk-mock.ts`, so it exercises the real `ai` package):

```ts
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
```

- [ ] **Step 3: Verify the new tests pass on current versions (baseline)**

Run: `bun test --isolate test/output/markdown.test.ts test/ai/zod-schema.test.ts`

Expected: PASS on the pre-upgrade versions, establishing a regression baseline. (If the `breaks`/`<br>` assertion needs adjustment to the installed Marked output, correct it now so it reflects intended behavior.)

- [ ] **Step 4: Bump the four dependencies in `package.json`**

Set these versions (use the latest published patch of the target major if the exact patch is unavailable):

```jsonc
  "dependencies": {
    // ...
    "commander": "^15.0.0",
    "marked": "^18.0.6",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    // ...
    "typescript": "^7.0.2"
  }
```

- [ ] **Step 5: Regenerate the lockfile with Bun**

Run: `bun install`

Expected: `bun.lock` updates; installation succeeds under Bun.

- [ ] **Step 6: Run the full check and fix only upgrade-forced issues**

Run: `bun run check`

Expected: PASS. If `tsc --noEmit` (TypeScript 7), Oxlint, or a test fails, apply the minimal change the upgraded types/tests require — do not combine with unrelated refactoring. Re-run `bun run check` until green.

- [ ] **Step 7: Commit the dependency upgrade**

```bash
git add package.json bun.lock test/output/markdown.test.ts test/ai/zod-schema.test.ts
git commit -m "chore: upgrade commander, marked, zod, and typescript"
```

---

### Task 6: Continuous integration modernization

Move CI to current action majors, split quality from a package-smoke matrix (Node 24 LTS and Node 26 Current) that exercises the installed binary including HTML export, and give CI read-only repository permissions.

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

**Interfaces:**

- Consumes: `test/fixtures/sample-scrutiny.json` (project name `test-project`); the packed npm artifact (`bin/**`, `src/**`).
- Produces: a `quality` job and a `package-smoke` matrix job.

- [ ] **Step 1: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run check

  package-smoke:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [24, 26] # 24 LTS, 26 Current (forward compatibility, not LTS)
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
      - run: bun install --frozen-lockfile
      - name: Pack the npm artifact
        run: npm pack --pack-destination "$RUNNER_TEMP"
      - name: Install and smoke-test the packed CLI
        run: |
          set -euo pipefail
          tarball="$(ls "$RUNNER_TEMP"/reddit-scrutinizer-*.tgz)"
          workdir="$RUNNER_TEMP/smoke"
          mkdir -p "$workdir"
          cd "$workdir"
          npm init -y >/dev/null
          npm install "$tarball"
          bin="$workdir/node_modules/.bin/reddit-scrutinizer"
          "$bin" --version
          "$bin" --help
          "$bin" completions bash | head -n 1
          "$bin" export "$GITHUB_WORKSPACE/test/fixtures/sample-scrutiny.json" -o "$workdir/out.html"
          test -f "$workdir/out.html"
          grep -q "test-project — reddit-scrutinizer" "$workdir/out.html"
```

- [ ] **Step 2: Add checkout to `.github/workflows/release.yml`**

Add `- uses: actions/checkout@v7` as the first step of the `release` job (before the `gh release create` step); keep `permissions: contents: write` unchanged:

```yaml
steps:
  - uses: actions/checkout@v7
  - run: gh release create "${{ github.ref_name }}" --generate-notes
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Validate workflow YAML locally**

Run:

```bash
bun run src/index.ts export test/fixtures/sample-scrutiny.json -o /tmp/rs-smoke.html
grep -q "test-project — reddit-scrutinizer" /tmp/rs-smoke.html && echo "export smoke OK"
```

Expected: prints `export smoke OK`, mirroring the CI smoke assertion. (Actual matrix runs execute on push.)

- [ ] **Step 4: Commit CI changes**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci: modernize actions and add a package-smoke matrix"
```

---

### Task 7: Documentation and changelog

Document the export flag, subcommand, filename rules, and trusted-input warning; add the 0.6.0 changelog entries for export, titles, dependencies, and CI; update AGENTS.md architecture, export behavior, and tests.

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Documents the behavior implemented in Tasks 1-6.

- [ ] **Step 1: Update the README Options table and Usage examples**

Add two rows to the Options table (after the `--open` row):

```md
| `--export-html` | `false` | Also write a self-contained HTML file next to the JSON |
| `--export-theme <name>` | `--theme` value | HTML export theme; repeatable, requires `--export-html`, replaces the default theme |
```

Add export examples in the Usage section:

```bash
# Also write a self-contained HTML file next to the JSON
reddit-scrutinizer ./my-project --export-html

# Export multiple themes at once
reddit-scrutinizer ./my-project --export-html --export-theme reddit --export-theme hackernews
```

- [ ] **Step 2: Add an Export command section to the README**

Insert a new `## Export command` section after the `## Serve command` section and before `## Shell completions`:

````md
## Export command

Generate a self-contained HTML file from an existing scrutiny JSON file. The `export` command never starts a server or opens a browser.

```bash
reddit-scrutinizer export ./reddit-scrutiny.json
reddit-scrutinizer export ./reddit-scrutiny.json --theme qdb
reddit-scrutinizer export ./reddit-scrutiny.json --theme reddit --theme hackernews -o demo.html
```
````

`--theme` is repeatable and defaults to `reddit`. `-o, --output` sets the output base; a value without an `.html` extension receives one.

### Filenames

- One theme uses the unsuffixed name: `scrutiny.json` → `scrutiny.html`.
- Multiple themes suffix every file: `scrutiny.json` + `reddit`,`hackernews` → `scrutiny-reddit.html`, `scrutiny-hackernews.html`.
- With `-o demo.html` and multiple themes: `demo-reddit.html`, `demo-qdb.html`.

> **Trusted input only.** Exported and served pages render the stored `body_html` without sanitization. Only export or serve scrutiny JSON that you generated or otherwise trust; do not open files from an untrusted source.

````

- [ ] **Step 3: Add 0.6.0 changelog entries**

In `CHANGELOG.md`, under the existing `## [0.6.0] - 2026-07-19` section, add to `### Added`:

```md
- Self-contained HTML export: `--export-html` on the main command and a standalone `export <file>` subcommand, with repeatable themes and offline (no-network) output
- Project-specific browser titles (`<Project Name> — reddit-scrutinizer`) for every served and exported theme
````

Add to `### Changed`:

```md
- Upgraded commander (15), marked (18), zod (4), and typescript (7)
- CI uses current action majors (`actions/checkout@v7`, `actions/setup-node@v7`, `oven-sh/setup-bun@v2`) with read-only permissions and a Node 24/26 package-smoke matrix
```

Leave earlier historical entries unchanged.

- [ ] **Step 4: Update AGENTS.md**

In the `### Directory structure` block, add under `output/`:

```
    export-html.ts     Self-contained HTML export (parse, theme resolve, render, atomic write)
```

Update the `ui/templates/` line to note the dual loader:

```
    templates/         HTML templates for all six UI themes (embedded export data or /api/data; project title)
```

In the `test/` block, add:

```
  output/export-html.test.ts   Export module unit tests
  export-command.test.ts       Export subcommand integration test
  ai/zod-schema.test.ts        Zod-through-AI-SDK conversion boundary
```

Add a short subsection after `### AI client pattern`:

```md
### HTML export

`output/export-html.ts` parses and validates scrutiny JSON with `ScrutinyOutputSchema`, resolves themes and output paths, renders a template with embedded script-safe JSON and an HTML-escaped project title, and writes each file atomically (temp file + rename). It is reused by the main command's `--export-html` flag and the `export <file>` subcommand. The `export` subcommand never starts or opens a server. Completions are generated from the Commander tree, so `export`, `--export-html`, and `--export-theme` appear automatically.
```

- [ ] **Step 5: Verify documented commands run**

Run:

```bash
bun run src/index.ts --help
bun run src/index.ts export --help
bun run src/index.ts export test/fixtures/sample-scrutiny.json -o /tmp/rs-doc.html && test -f /tmp/rs-doc.html
```

Expected: help shows `--export-html`, `--export-theme`, and the `export` subcommand; the export writes `/tmp/rs-doc.html`.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md CHANGELOG.md AGENTS.md
git commit -m "docs: document HTML export, titles, dependencies, and CI"
```

---

### Task 8: Full verification and review

**Files:**

- Review all files changed by Tasks 1-7.

- [ ] **Step 1: Run the complete repository check**

Run: `bun run check`

Expected: format check, lint, TypeScript 7 typecheck, coverage, and all isolated tests PASS.

- [ ] **Step 2: Smoke-test export and completions end to end**

Run:

```bash
bun run src/index.ts export test/fixtures/sample-scrutiny.json --theme reddit --theme qdb -o /tmp/rs/out.html
test -f /tmp/rs/out-reddit.html && test -f /tmp/rs/out-qdb.html
grep -q "test-project — reddit-scrutinizer" /tmp/rs/out-reddit.html
grep -q "scrutiny-data" /tmp/rs/out-qdb.html
grep -qi "/api/data" /tmp/rs/out-reddit.html
bun run src/index.ts completions bash | bash -n
bun run src/index.ts completions zsh > /tmp/_reddit-scrutinizer
bun run src/index.ts completions fish > /tmp/reddit-scrutinizer.fish
bun run src/index.ts completions powershell > /tmp/reddit-scrutinizer.ps1
```

Expected: both suffixed files exist with the project title, embedded data, and an `/api/data` fallback; all four completion generators exit 0 and Bash parses.

- [ ] **Step 3: Confirm offline rendering makes no network requests**

Manually verify by opening `/tmp/rs/out-reddit.html` in a browser with dev tools Network tab (or reasoning from the source): the page loads from the embedded `<script id="scrutiny-data">` and issues no requests. Confirm the title reads `test-project — reddit-scrutinizer`.

- [ ] **Step 4: Review the scoped diff**

Inspect only the files changed for this work. Confirm no unrelated user changes were staged, no API keys/prompts/snippets are logged, `schema_version` is still `"1.0"`, and no export retry/archive/sanitization crept in. Correct any functional or documentation defects with focused tests.

- [ ] **Step 5: Re-run `bun run check` after any review changes**

Expected: PASS with no warnings. Do not tag, publish, or create a release — the user will run a weird-project demo before authorizing publication.

```

```
