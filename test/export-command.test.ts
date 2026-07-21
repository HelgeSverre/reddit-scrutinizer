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
    process.stdout.write = ((chunk: string) => {
      printed.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
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
