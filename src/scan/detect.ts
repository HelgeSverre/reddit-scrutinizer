import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const EXT_TO_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".rs": "Rust",
  ".py": "Python",
  ".go": "Go",
  ".rb": "Ruby",
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".lua": "Lua",
  ".zig": "Zig",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".hs": "Haskell",
  ".ml": "OCaml",
  ".mli": "OCaml",
  ".scala": "Scala",
  ".clj": "Clojure",
  ".cljs": "Clojure",
  ".dart": "Dart",
  ".r": "R",
  ".R": "R",
  ".sql": "SQL",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Shell",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".md": "Markdown",
  ".mdx": "MDX",
};

export interface LanguageEntry {
  name: string;
  pct: number;
  files: number;
}

export function detectLanguages(files: { path: string; size: number }[]): LanguageEntry[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    const dot = file.path.lastIndexOf(".");
    if (dot === -1) continue;
    const ext = file.path.slice(dot).toLowerCase();
    const lang = EXT_TO_LANGUAGE[ext];
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(counts.entries())
    .map(([name, fileCount]) => ({
      name,
      pct: Math.round((fileCount / total) * 1000) / 10,
      files: fileCount,
    }))
    .sort((a, b) => b.files - a.files);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function detectStack(rootPath: string): Promise<string[]> {
  const stack: string[] = [];

  const checks: [string, string][] = [
    ["package.json", "Node.js"],
    ["Cargo.toml", "Rust"],
    ["go.mod", "Go"],
    ["pyproject.toml", "Python"],
    ["requirements.txt", "Python"],
    ["setup.py", "Python"],
    ["Gemfile", "Ruby"],
    ["pom.xml", "Java (Maven)"],
    ["build.gradle", "Java (Gradle)"],
    ["build.gradle.kts", "Kotlin (Gradle)"],
    ["Package.swift", "Swift"],
    ["mix.exs", "Elixir"],
    ["Makefile", "Make"],
    ["CMakeLists.txt", "CMake"],
    ["Dockerfile", "Docker"],
    ["docker-compose.yml", "Docker Compose"],
    ["docker-compose.yaml", "Docker Compose"],
    [".github/workflows", "GitHub Actions"],
    [".gitlab-ci.yml", "GitLab CI"],
    ["Jenkinsfile", "Jenkins"],
    [".circleci/config.yml", "CircleCI"],
    ["vercel.json", "Vercel"],
    ["netlify.toml", "Netlify"],
    ["fly.toml", "Fly.io"],
    ["terraform.tf", "Terraform"],
    ["tsconfig.json", "TypeScript"],
    ["biome.json", "Biome"],
    [".eslintrc.json", "ESLint"],
    [".prettierrc", "Prettier"],
  ];

  for (const [file, label] of checks) {
    if (await fileExists(join(rootPath, file))) {
      stack.push(label);
    }
  }

  // Detect frameworks from package.json
  const pkg = await readJson(join(rootPath, "package.json"));
  if (pkg) {
    const allDeps: Record<string, unknown> = {
      ...(typeof pkg.dependencies === "object" && pkg.dependencies ? pkg.dependencies : {}),
      ...(typeof pkg.devDependencies === "object" && pkg.devDependencies ? pkg.devDependencies : {}),
    };

    const frameworks: [string, string][] = [
      ["react", "React"],
      ["next", "Next.js"],
      ["vue", "Vue"],
      ["nuxt", "Nuxt"],
      ["svelte", "Svelte"],
      ["@sveltejs/kit", "SvelteKit"],
      ["angular", "Angular"],
      ["@angular/core", "Angular"],
      ["express", "Express"],
      ["fastify", "Fastify"],
      ["hono", "Hono"],
      ["koa", "Koa"],
      ["nestjs", "NestJS"],
      ["@nestjs/core", "NestJS"],
      ["tailwindcss", "Tailwind CSS"],
      ["prisma", "Prisma"],
      ["drizzle-orm", "Drizzle"],
      ["mongoose", "Mongoose"],
      ["electron", "Electron"],
      ["vite", "Vite"],
      ["webpack", "Webpack"],
      ["esbuild", "esbuild"],
      ["jest", "Jest"],
      ["vitest", "Vitest"],
      ["mocha", "Mocha"],
      ["playwright", "Playwright"],
      ["cypress", "Cypress"],
    ];

    for (const [dep, label] of frameworks) {
      if (dep in allDeps && !stack.includes(label)) {
        stack.push(label);
      }
    }
  }

  return stack;
}

export async function detectLicense(rootPath: string): Promise<string | null> {
  const candidates = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md"];

  for (const name of candidates) {
    try {
      const content = await readFile(join(rootPath, name), "utf-8");
      const head = content.slice(0, 500).toLowerCase();

      if (head.includes("mit license") || head.includes("permission is hereby granted, free of charge"))
        return "MIT";
      if (head.includes("apache license") && head.includes("2.0"))
        return "Apache-2.0";
      if (head.includes("gnu general public license") || head.includes("gpl")) {
        if (head.includes("version 3")) return "GPL-3.0";
        if (head.includes("version 2")) return "GPL-2.0";
        return "GPL";
      }
      if (head.includes("bsd")) {
        if (head.includes("3-clause") || head.includes("three clause")) return "BSD-3-Clause";
        if (head.includes("2-clause") || head.includes("two clause")) return "BSD-2-Clause";
        return "BSD";
      }
      if (head.includes("isc license")) return "ISC";
      if (head.includes("mozilla public license")) return "MPL-2.0";
      if (head.includes("unlicense")) return "Unlicense";

      return "Unknown";
    } catch {
      continue;
    }
  }

  return null;
}

export function detectTests(files: { path: string; size: number }[]): boolean {
  return files.some((f) => {
    const lower = f.path.toLowerCase();
    return (
      lower.includes("test") ||
      lower.includes("spec") ||
      lower.includes("__tests__")
    );
  });
}
