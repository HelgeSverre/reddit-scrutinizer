import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { WalkEntry } from "./walk";

export type FileKind = "source" | "test" | "config" | "manifest" | "doc" | "ci" | "other";

export interface FileIndexEntry {
  path: string;
  size: number;
  kind: FileKind;
}

export interface FileIndex {
  files: FileIndexEntry[];
  total_scanned: number;
}

export interface DiscoveryRead {
  path: string;
  start_line: number;
  line_count: number;
  reason: string;
  priority: number;
}

export interface DiscoveryPlan {
  reads: DiscoveryRead[];
}

export interface EvidenceSnippet {
  id: string;
  path: string;
  start_line: number;
  end_line: number;
  content: string;
  reason: string;
}

export interface RiskSignal {
  pattern: string;
  file: string;
  count: number;
}

export interface PatternSummary {
  signals: RiskSignal[];
  total_files_with_signals: number;
}

export function classifyFile(path: string): FileKind {
  const lower = path.toLowerCase();
  const base = basename(lower);
  const ext = extname(lower);

  if (
    lower.includes("/test/") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    base.includes(".test.") ||
    base.includes(".spec.") ||
    base.startsWith("test_") ||
    base.endsWith("_test.go") ||
    base.endsWith("_test.rs")
  ) {
    return "test";
  }

  const manifests = new Set([
    "package.json", "cargo.toml", "go.mod", "pyproject.toml", "setup.py",
    "gemfile", "pom.xml", "build.gradle", "build.gradle.kts", "mix.exs",
    "package.swift", "composer.json",
  ]);
  if (manifests.has(base)) return "manifest";

  if (
    base === "tsconfig.json" || base === "biome.json" || base === "makefile" ||
    base === "dockerfile" || base === ".env.example" ||
    base.startsWith("vite.config") || base.startsWith("webpack.config") ||
    base.startsWith("next.config") || base.startsWith("tailwind.config") ||
    base.startsWith(".eslintrc") || base.startsWith("docker-compose")
  ) {
    return "config";
  }

  if (lower.includes(".github/workflows") || base === ".gitlab-ci.yml" || base === "jenkinsfile" || lower.includes(".circleci")) {
    return "ci";
  }

  if ([".md", ".mdx", ".rst", ".txt"].includes(ext) || base.startsWith("readme") || base.startsWith("changelog")) {
    return "doc";
  }

  const sourceExts = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".py", ".go", ".rb",
    ".java", ".kt", ".kts", ".swift", ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp",
    ".cs", ".php", ".lua", ".zig", ".ex", ".exs", ".hs", ".ml", ".mli", ".scala",
    ".clj", ".cljs", ".dart", ".vue", ".svelte", ".sql", ".sh", ".bash",
  ]);
  if (sourceExts.has(ext)) return "source";

  return "other";
}

export function buildFileIndex(files: WalkEntry[]): FileIndex {
  const entries: FileIndexEntry[] = files.map((f) => ({
    path: f.path,
    size: f.size,
    kind: classifyFile(f.path),
  }));

  const priority: Record<FileKind, number> = {
    manifest: 0, config: 1, ci: 2, source: 3, test: 4, doc: 5, other: 6,
  };

  entries.sort((a, b) => {
    const p = priority[a.kind] - priority[b.kind];
    if (p !== 0) return p;
    return b.size - a.size;
  });

  return {
    files: entries.slice(0, 200),
    total_scanned: files.length,
  };
}

export async function readSnippet(
  rootPath: string,
  relPath: string,
  startLine: number,
  lineCount: number,
  maxChars: number = 8000,
): Promise<{ content: string; endLine: number } | null> {
  try {
    const raw = await readFile(join(rootPath, relPath), "utf-8");
    const allLines = raw.split("\n");
    const start = Math.max(0, startLine - 1);
    const end = Math.min(allLines.length, start + lineCount);
    const selected = allLines.slice(start, end);

    let result = "";
    let actualEnd = start;
    for (const line of selected) {
      const truncated = line.length > 200 ? line.slice(0, 200) + "…" : line;
      if (result.length + truncated.length + 1 > maxChars) break;
      result += truncated + "\n";
      actualEnd++;
    }

    return { content: result, endLine: actualEnd };
  } catch {
    return null;
  }
}

export async function executeDiscoveryPlan(
  rootPath: string,
  plan: DiscoveryPlan,
): Promise<EvidenceSnippet[]> {
  const snippets: EvidenceSnippet[] = [];

  const sorted = [...plan.reads].sort((a, b) => a.priority - b.priority);

  for (const read of sorted) {
    const result = await readSnippet(rootPath, read.path, read.start_line, read.line_count);
    if (!result) continue;

    snippets.push({
      id: `E${snippets.length + 1}`,
      path: read.path,
      start_line: read.start_line,
      end_line: result.endLine,
      content: result.content,
      reason: read.reason,
    });
  }

  return snippets;
}

const RISK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/i, label: "TODO/FIXME/HACK" },
  { pattern: /\beval\s*\(/, label: "eval()" },
  { pattern: /\.innerHTML\s*=/, label: "innerHTML assignment" },
  { pattern: /dangerouslySetInnerHTML/, label: "dangerouslySetInnerHTML" },
  { pattern: /eslint-disable/, label: "eslint-disable" },
  { pattern: /@ts-ignore|@ts-expect-error/, label: "@ts-ignore" },
  { pattern: /as\s+any\b/, label: "as any" },
  { pattern: /child_process|execSync|spawnSync/, label: "child_process" },
  { pattern: /\bexec\s*\(/, label: "exec()" },
  { pattern: /\.query\s*\(\s*[`"'].*\$\{/, label: "string-interpolated query" },
  { pattern: /console\.(log|warn|error)\s*\(/, label: "console.log" },
];

export async function scanRiskPatterns(
  rootPath: string,
  files: WalkEntry[],
): Promise<PatternSummary> {
  const classified = files.map((f) => ({ ...f, kind: classifyFile(f.path) }));
  const scannable = classified
    .filter((f) => f.kind === "source" || f.kind === "test" || f.kind === "config")
    .slice(0, 50);

  const signals: RiskSignal[] = [];
  const filesWithSignals = new Set<string>();

  for (const file of scannable) {
    try {
      const content = await readFile(join(rootPath, file.path), "utf-8");
      const lines = content.split("\n").slice(0, 500);
      const text = lines.join("\n");

      for (const { pattern, label } of RISK_PATTERNS) {
        const matches = text.match(new RegExp(pattern.source, pattern.flags + "g"));
        if (matches && matches.length > 0) {
          signals.push({ pattern: label, file: file.path, count: matches.length });
          filesWithSignals.add(file.path);
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return {
    signals,
    total_files_with_signals: filesWithSignals.size,
  };
}
