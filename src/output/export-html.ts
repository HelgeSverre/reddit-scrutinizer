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
