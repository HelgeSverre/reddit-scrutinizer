import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { walkDirectory, type WalkEntry } from "./walk";
import { detectLanguages, detectLicense, detectStack, detectTests } from "./detect";

export interface ProjectDossier {
  name: string;
  description: string;
  languages: { name: string; pct: number; files: number }[];
  stack: string[];
  has_tests: boolean;
  has_ci: boolean;
  license: string | null;
  readme: string;
  file_tree: string;
  excerpts: { path: string; content: string; why: string }[];
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function readReadme(rootPath: string): Promise<string> {
  const candidates = ["README.md", "README", "README.rst", "readme.md", "Readme.md"];
  for (const name of candidates) {
    const content = await readTextFile(join(rootPath, name));
    if (content) return content.slice(0, 2000);
  }
  return "";
}

function extractDescription(readme: string, manifest: Record<string, unknown> | null): string {
  if (manifest?.description && typeof manifest.description === "string") {
    return manifest.description;
  }

  if (!readme) return "";

  const lines = readme.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings, badges, empty lines
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("[!") || trimmed.startsWith("[![")) continue;
    if (trimmed.startsWith("![")) continue;
    if (trimmed.startsWith("---")) continue;
    return trimmed.slice(0, 300);
  }
  return "";
}

async function detectProjectName(
  rootPath: string,
): Promise<[string, Record<string, unknown> | null]> {
  // Try package.json
  const pkgContent = await readTextFile(join(rootPath, "package.json"));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      if (pkg.name) return [pkg.name, pkg];
    } catch {
      /* ignore */
    }
  }

  // Try Cargo.toml
  const cargo = await readTextFile(join(rootPath, "Cargo.toml"));
  if (cargo) {
    const name = cargo.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    if (name) return [name, null];
  }

  // Try go.mod
  const gomod = await readTextFile(join(rootPath, "go.mod"));
  if (gomod) {
    const modulePath = gomod.match(/^module\s+(\S+)/m)?.[1];
    if (modulePath) {
      const name = modulePath.split("/").at(-1);
      if (name) return [name, null];
    }
  }

  // Try pyproject.toml
  const pyproj = await readTextFile(join(rootPath, "pyproject.toml"));
  if (pyproj) {
    const name = pyproj.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    if (name) return [name, null];
  }

  return [basename(rootPath), null];
}

function buildFileTree(files: WalkEntry[], maxLines: number = 100): string {
  const dirFiles = new Map<string, string[]>();

  for (const file of files) {
    const dir = dirname(file.path);
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(basename(file.path));
  }

  const lines: string[] = [];
  const sortedDirs = Array.from(dirFiles.keys()).sort();

  for (const dir of sortedDirs) {
    if (lines.length >= maxLines) break;

    const fileNames = dirFiles.get(dir)!;
    const prefix = dir === "." ? "" : dir + "/";

    if (fileNames.length > 8) {
      lines.push(`${prefix} (${fileNames.length} files)`);
    } else {
      for (const name of fileNames) {
        if (lines.length >= maxLines) break;
        lines.push(`${prefix}${name}`);
      }
    }
  }

  if (lines.length >= maxLines) {
    lines.push(`... (${files.length} files total)`);
  }

  return lines.join("\n");
}

const MANIFEST_FILES = new Set([
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "setup.py",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "mix.exs",
  "Package.swift",
]);

const CONFIG_FILES = new Set([
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "next.config.js",
  "next.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "biome.json",
  ".eslintrc.json",
  "Makefile",
  "Dockerfile",
  "docker-compose.yml",
]);

const ENTRYPOINT_PATTERNS = [
  "src/main",
  "src/index",
  "src/app",
  "src/lib",
  "main",
  "index",
  "app",
  "lib",
  "mod.rs",
  "lib.rs",
  "main.rs",
  "main.go",
  "main.py",
  "app.py",
];

function isTestFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.includes("test") || lower.includes("spec") || lower.includes("__tests__");
}

function selectExcerpts(files: WalkEntry[]): { path: string; why: string }[] {
  const selected: { path: string; why: string }[] = [];
  const used = new Set<string>();

  function add(path: string, why: string) {
    if (used.has(path) || selected.length >= 15) return;
    used.add(path);
    selected.push({ path, why });
  }

  // 1. Entrypoints
  for (const pattern of ENTRYPOINT_PATTERNS) {
    const match = files.find(
      (f) =>
        f.path.startsWith(pattern) ||
        f.path.endsWith(`/${pattern}`) ||
        basename(f.path, ".ts") === pattern ||
        basename(f.path, ".js") === pattern,
    );
    if (match) add(match.path, "main entrypoint");
  }

  // 2. Manifests
  for (const file of files) {
    if (MANIFEST_FILES.has(basename(file.path))) {
      add(file.path, "package manifest");
    }
  }

  // 3. Config files
  for (const file of files) {
    if (CONFIG_FILES.has(basename(file.path))) {
      add(file.path, "config file");
    }
  }

  // 4. Largest non-test source files (core modules)
  const sourceFiles = files
    .filter(
      (f) =>
        !isTestFile(f.path) &&
        !MANIFEST_FILES.has(basename(f.path)) &&
        !CONFIG_FILES.has(basename(f.path)),
    )
    .filter((f) => {
      const ext = f.path.slice(f.path.lastIndexOf(".")).toLowerCase();
      return [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".rs",
        ".py",
        ".go",
        ".rb",
        ".java",
        ".c",
        ".cpp",
        ".cs",
        ".php",
        ".swift",
        ".kt",
        ".zig",
        ".ex",
        ".hs",
        ".scala",
        ".clj",
        ".dart",
        ".lua",
        ".vue",
        ".svelte",
      ].includes(ext);
    })
    .sort((a, b) => b.size - a.size);

  for (const file of sourceFiles) {
    if (selected.length >= 15) break;
    add(file.path, "core module (largest)");
  }

  return selected;
}

async function readExcerpts(
  rootPath: string,
  selections: { path: string; why: string }[],
): Promise<{ path: string; content: string; why: string }[]> {
  const excerpts: { path: string; content: string; why: string }[] = [];

  for (const sel of selections) {
    const content = await readTextFile(join(rootPath, sel.path));
    if (!content) continue;

    const lines = content.split("\n").slice(0, 100);
    excerpts.push({
      path: sel.path,
      content: lines.join("\n"),
      why: sel.why,
    });
  }

  return excerpts;
}

export async function buildDossier(rootPath: string): Promise<ProjectDossier> {
  const files = await walkDirectory(rootPath);
  const [name, manifest] = await detectProjectName(rootPath);
  const languages = detectLanguages(files);
  const stack = await detectStack(rootPath);
  const license = await detectLicense(rootPath);
  const hasTests = detectTests(files);
  const hasCi =
    stack.includes("GitHub Actions") ||
    stack.includes("GitLab CI") ||
    stack.includes("CircleCI") ||
    stack.includes("Jenkins");
  const readme = await readReadme(rootPath);
  const description = extractDescription(readme, manifest);
  const fileTree = buildFileTree(files);
  const selections = selectExcerpts(files);
  const excerpts = await readExcerpts(rootPath, selections);

  return {
    name,
    description,
    languages,
    stack,
    has_tests: hasTests,
    has_ci: hasCi,
    license,
    readme,
    file_tree: fileTree,
    excerpts,
  };
}
