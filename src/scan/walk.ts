import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import ignore from "ignore";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  "__pycache__",
  ".next",
  ".cache",
  "vendor",
  "coverage",
]);

const BINARY_EXTENSIONS = new Set([
  // images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".tiff",
  // fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  // compiled / binary
  ".o",
  ".so",
  ".dylib",
  ".dll",
  ".exe",
  ".bin",
  ".class",
  ".pyc",
  ".pyo",
  ".wasm",
  ".node",
  // archives
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".jar",
  ".war",
  // media
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".flac",
  ".avi",
  ".mov",
  ".mkv",
  ".webm",
  // data / db
  ".db",
  ".sqlite",
  ".sqlite3",
  // misc
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".DS_Store",
  ".lock",
]);

export interface WalkEntry {
  path: string;
  size: number;
}

async function loadGitignore(rootPath: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();
  try {
    const content = await readFile(join(rootPath, ".gitignore"), "utf-8");
    ig.add(content);
  } catch {
    // no .gitignore — that's fine
  }
  return ig;
}

function isBinaryPath(filePath: string): boolean {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

export async function walkDirectory(
  rootPath: string,
  maxFiles: number = 500,
): Promise<WalkEntry[]> {
  const ig = await loadGitignore(rootPath);
  const results: WalkEntry[] = [];

  async function walk(dir: string) {
    if (results.length >= maxFiles) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;

      const fullPath = join(dir, entry.name);
      const relPath = relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (ig.ignores(relPath + "/")) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (isBinaryPath(entry.name)) continue;
        if (ig.ignores(relPath)) continue;

        try {
          const info = await stat(fullPath);
          results.push({ path: relPath, size: info.size });
        } catch {
          // skip files we can't stat
        }
      }
    }
  }

  await walk(rootPath);
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}
