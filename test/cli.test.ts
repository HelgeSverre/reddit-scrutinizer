import { describe, expect, test } from "bun:test";
import type { Command } from "commander";
import pkg from "../package.json";
import { createProgram, type MainOptions, type ServeOptions } from "../src/cli";

const themes = ["reddit", "hackernews", "producthunt", "twitter", "bluesky", "qdb"];

function quiet(program: Command): Command {
  program.exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
  for (const command of program.commands) {
    quiet(command);
  }
  return program;
}

function parseMain(args: string[]): { path: string; options: MainOptions } {
  let capture: { path: string; options: MainOptions } | undefined;
  const program = quiet(
    createProgram({
      run: (path, options) => {
        capture = { path, options };
      },
    }),
  );

  program.parse(["node", "reddit-scrutinizer", ...args]);
  expect(capture).toBeDefined();
  return capture!;
}

function parseServe(args: string[]): { file: string; options: ServeOptions } {
  let capture: { file: string; options: ServeOptions } | undefined;
  const program = quiet(
    createProgram({
      serve: (file, options) => {
        capture = { file, options };
      },
    }),
  );

  program.parse(["node", "reddit-scrutinizer", "serve", ...args]);
  expect(capture).toBeDefined();
  return capture!;
}

function parseCompletions(args: string[]): string {
  let capture: string | undefined;
  const program = quiet(
    createProgram({
      completions: (shell: string) => {
        capture = shell;
      },
    }),
  );

  program.parse(["node", "reddit-scrutinizer", "completions", ...args]);
  expect(capture).toBeDefined();
  return capture!;
}

describe("CLI option parsing", () => {
  test("parses main options after the project path", () => {
    const { path, options } = parseMain([
      "./project",
      "--comments",
      "60",
      "--port",
      "8080",
      "--temperature",
      "0.5",
      "--seed",
      "12345",
      "--theme",
      "twitter",
      "--verbose",
    ]);

    expect(path).toBe("./project");
    expect(options.comments).toBe(60);
    expect(options.port).toBe(8080);
    expect(options.temperature).toBe(0.5);
    expect(options.seed).toBe(12345);
    expect(options.theme).toBe("twitter");
    expect(options.verbose).toBe(true);
  });

  test("parses main options before the project path", () => {
    const { options } = parseMain(["--comments", "12", "--theme", "qdb", "./project"]);
    expect(options.comments).toBe(12);
    expect(options.theme).toBe("qdb");
  });

  test("uses documented main defaults", () => {
    const { options } = parseMain(["./project"]);
    expect(options).toMatchObject({
      subreddit: "programming",
      comments: 40,
      maxDepth: 4,
      maxReplies: 3,
      style: "balanced",
      theme: "reddit",
      open: false,
      port: 3000,
      temperature: 0.8,
      batchSize: 50,
      verbose: false,
    });
    expect("ui" in options).toBe(false);
  });

  test("opens the generated UI only when --open is provided", () => {
    expect(parseMain(["./project"]).options.open).toBe(false);
    expect(parseMain(["./project", "--open"]).options.open).toBe(true);
  });

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

  test("rejects the removed --no-ui option", () => {
    expect(() => parseMain(["./project", "--no-ui"])).toThrow("unknown option '--no-ui'");
  });

  test.each(themes)("accepts the %s theme", (theme) => {
    expect(parseMain(["./project", "--theme", theme]).options.theme).toBe(theme);
    expect(parseServe(["data.json", "--theme", theme]).options.theme).toBe(theme);
  });

  test("parses serve options and defaults", () => {
    const result = parseServe(["data.json", "--port", "5555", "--open", "--verbose"]);
    expect(result.file).toBe("data.json");
    expect(result.options).toMatchObject({
      port: 5555,
      open: true,
      theme: "reddit",
      verbose: true,
    });
  });

  test("parses the completions shell", () => {
    expect(parseCompletions(["bash"])).toBe("bash");
  });

  test("rejects unsupported completion shells", () => {
    expect(() => parseCompletions(["tcsh"])).toThrow();
  });

  test("rejects malformed or out-of-range numeric options", () => {
    const invalidArgs = [
      ["./project", "--comments", "nope"],
      ["./project", "--comments", "0"],
      ["./project", "--max-depth", "-1"],
      ["./project", "--max-replies", "-1"],
      ["./project", "--temperature", "1.1"],
      ["./project", "--port", "70000"],
      ["./project", "--batch-size", "0"],
      ["./project", "--max-tokens", "0"],
      ["./project", "--seed", "3.14"],
    ];

    for (const args of invalidArgs) {
      expect(() =>
        quiet(createProgram({ run: () => {} })).parse(["node", "test", ...args]),
      ).toThrow();
    }
  });

  test("rejects invalid themes", () => {
    expect(() =>
      quiet(createProgram({ run: () => {} })).parse([
        "node",
        "test",
        "./project",
        "--theme",
        "foobar",
      ]),
    ).toThrow();
  });

  test("reports the package version", () => {
    expect(createProgram().version()).toBe(pkg.version);
  });

  test("help documents verbose output, themes, and examples", () => {
    let help = "";
    const program = createProgram().configureOutput({ writeOut: (chunk) => (help += chunk) });
    program.outputHelp();
    expect(help).toContain("--verbose");
    expect(help).toContain("twitter");
    expect(help).toContain("bluesky");
    expect(help).toContain("Examples:");
    expect(help).toContain("reddit-scrutinizer ./my-project --subreddit rust");
  });
});
