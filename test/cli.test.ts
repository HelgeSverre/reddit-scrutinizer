import { describe, test, expect } from "bun:test";
import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const toInt = (v: string) => parseInt(v, 10);
const toFloat = (v: string) => parseFloat(v);

function buildProgram() {
  const program = new Command();
  program
    .name("reddit-scrutinizer")
    .version(pkg.version)
    .exitOverride()
    .enablePositionalOptions()
    .passThroughOptions();

  let mainCapture: { path: string } | null = null;
  program
    .argument("<path>")
    .option("--subreddit <name>", "subreddit", "programming")
    .option("--comments <n>", "comments", toInt, 40)
    .option("--port <n>", "port", toInt, 3000)
    .option("--open", "open browser", false)
    .option("--temperature <n>", "temperature", toFloat, 0.8)
    .option("--seed <n>", "seed", toInt)
    .addOption(
      new Option("--theme <name>", "UI theme")
        .choices(["reddit", "hackernews", "producthunt"])
        .default("reddit"),
    )
    .action((path: string) => {
      mainCapture = { path };
    });

  let serveCapture: { file: string; opts: any } | null = null;
  program
    .command("serve <file>")
    .option("--port <n>", "server port", toInt, 3000)
    .option("--open", "open browser", false)
    .addOption(
      new Option("--theme <name>", "UI theme")
        .choices(["reddit", "hackernews", "producthunt"])
        .default("reddit"),
    )
    .action((file: string, opts: any) => {
      serveCapture = { file, opts };
    });

  return {
    program,
    getMainCapture: () => mainCapture,
    getServeCapture: () => serveCapture,
  };
}

describe("CLI option parsing", () => {
  // Note: passThroughOptions means options must come BEFORE the <path> argument
  test("main command parses --port as integer", () => {
    const { program } = buildProgram();
    program.parse(["node", "test", "--port", "4567", "./my-project"]);
    expect(program.opts().port).toBe(4567);
  });

  test("main command uses default port 3000", () => {
    const { program } = buildProgram();
    program.parse(["node", "test", "./my-project"]);
    expect(program.opts().port).toBe(3000);
  });

  test("serve subcommand parses --port as integer", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "data.json", "--port", "5555"]);
    expect(getServeCapture()!.opts.port).toBe(5555);
  });

  test("serve subcommand uses default port 3000", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "data.json"]);
    expect(getServeCapture()!.opts.port).toBe(3000);
  });

  test("serve subcommand parses --open flag", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "data.json", "--open"]);
    expect(getServeCapture()!.opts.open).toBe(true);
  });

  test("serve subcommand captures file argument", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "my-results.json"]);
    expect(getServeCapture()!.file).toBe("my-results.json");
  });

  test("main command parses all numeric options correctly", () => {
    const { program } = buildProgram();
    program.parse([
      "node", "test",
      "--comments", "60",
      "--port", "8080",
      "--temperature", "0.5",
      "--seed", "12345",
      "./project",
    ]);
    const opts = program.opts();
    expect(opts.comments).toBe(60);
    expect(opts.port).toBe(8080);
    expect(opts.temperature).toBe(0.5);
    expect(opts.seed).toBe(12345);
  });

  test("--version outputs correct version from package.json", () => {
    const { program } = buildProgram();
    expect(program.version()).toBe(pkg.version);
  });

  test("main command parses --theme option", () => {
    const { program } = buildProgram();
    program.parse(["node", "test", "--theme", "hackernews", "./my-project"]);
    expect(program.opts().theme).toBe("hackernews");
  });

  test("main command defaults --theme to reddit", () => {
    const { program } = buildProgram();
    program.parse(["node", "test", "./my-project"]);
    expect(program.opts().theme).toBe("reddit");
  });

  test("serve subcommand parses --theme option", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "data.json", "--theme", "producthunt"]);
    expect(getServeCapture()!.opts.theme).toBe("producthunt");
  });

  test("serve subcommand defaults --theme to reddit", () => {
    const { program, getServeCapture } = buildProgram();
    program.parse(["node", "test", "serve", "data.json"]);
    expect(getServeCapture()!.opts.theme).toBe("reddit");
  });

  test("--theme rejects invalid choices", () => {
    const { program } = buildProgram();
    expect(() => {
      program.parse(["node", "test", "--theme", "foobar", "./my-project"]);
    }).toThrow();
  });

  test("serve --theme rejects invalid choices", () => {
    const { program } = buildProgram();
    expect(() => {
      program.parse(["node", "test", "serve", "data.json", "--theme", "foobar"]);
    }).toThrow();
  });
});
