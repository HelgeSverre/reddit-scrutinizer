import { Argument, Command, InvalidArgumentError, Option } from "commander";
import { resolve } from "node:path";
import { SUPPORTED_SHELLS, type Shell } from "./completions/model";
import { createProgressReporter } from "./progress";
import { TOOL_VERSION } from "./version";

export const THEMES = ["reddit", "hackernews", "producthunt", "twitter", "bluesky", "qdb"] as const;

export type Theme = (typeof THEMES)[number];

export interface MainOptions {
  subreddit: string;
  comments: number;
  maxDepth: number;
  maxReplies: number;
  style: string;
  theme: string;
  model: string;
  out: string;
  open: boolean;
  port: number;
  temperature: number;
  seed?: number;
  maxTokens?: number;
  batchSize: number;
  apiKey?: string;
  verbose: boolean;
}

export interface ServeOptions {
  port: number;
  open: boolean;
  theme: string;
  verbose: boolean;
}

interface ProgramHandlers {
  run?: (path: string, options: MainOptions) => void | Promise<void>;
  serve?: (file: string, options: ServeOptions) => void | Promise<void>;
  completions?: (shell: Shell) => void | Promise<void>;
}

function parseInteger(value: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new InvalidArgumentError("must be an integer");
  }
  return Number(value);
}

function parsePositiveInteger(value: string): number {
  const parsed = parseInteger(value);
  if (parsed < 1) throw new InvalidArgumentError("must be at least 1");
  return parsed;
}

function parseNonNegativeInteger(value: string): number {
  const parsed = parseInteger(value);
  if (parsed < 0) throw new InvalidArgumentError("must be 0 or greater");
  return parsed;
}

function parsePort(value: string): number {
  const parsed = parsePositiveInteger(value);
  if (parsed > 65_535) throw new InvalidArgumentError("must be between 1 and 65535");
  return parsed;
}

function parseTemperature(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new InvalidArgumentError("must be a number between 0 and 1");
  }
  return parsed;
}

async function serve(file: string, options: ServeOptions): Promise<void> {
  const progress = createProgressReporter({ verbose: options.verbose });
  const filePath = resolve(file);
  const stage = progress.stage(1, 1, "Waking up the tiny web server...");
  stage.detail(`Data: ${filePath}`);
  stage.detail(
    `Theme: ${options.theme}; preferred port: ${options.port}; open browser: ${options.open}`,
  );
  const { startServer } = await import("./ui/server");
  const actualPort = await startServer(filePath, options.port, options.open, options.theme);
  stage.complete(`Server listening on port ${actualPort}`);
  progress.success(`UI available at http://localhost:${actualPort}`);
}

export function createProgram(handlers: ProgramHandlers = {}): Command {
  const program = new Command();

  program
    .name("reddit-scrutinizer")
    .description("Simulate how Reddit would react to your project before you post it")
    .version(TOOL_VERSION)
    .enablePositionalOptions()
    .showHelpAfterError("(add --help for command details)")
    .showSuggestionAfterError();

  program
    .argument("<path>", "project directory to scrutinize")
    .option("--subreddit <name>", "subreddit voice to simulate", "programming")
    .option("--comments <n>", "comments to generate", parsePositiveInteger, 40)
    .option("--max-depth <n>", "maximum reply nesting depth", parseNonNegativeInteger, 4)
    .option(
      "--max-replies <n>",
      "maximum replies written by the simulated OP",
      parseNonNegativeInteger,
      3,
    )
    .addOption(
      new Option("--style <mode>", "tone of the comment section")
        .choices(["balanced", "snarky", "supportive", "hostile"])
        .default("balanced"),
    )
    .addOption(new Option("--theme <name>", "browser UI theme").choices(THEMES).default("reddit"))
    .option("--model <name>", "Anthropic model ID", "claude-sonnet-4-5-20250929")
    .option("--out <file>", "JSON output path", "./reddit-scrutiny.json")
    .option("--open", "start the browser UI and open it after generation", false)
    .option("--port <n>", "preferred browser UI port (used with --open)", parsePort, 3000)
    .option(
      "--temperature <n>",
      "sampling temperature from 0 to 1 (ignored by unsupported models)",
      parseTemperature,
      0.8,
    )
    .option("--seed <n>", "integer seed for reproducible scores and timestamps", parseInteger)
    .option(
      "--max-tokens <n>",
      "maximum output tokens per AI call (comment batches otherwise auto-scale up to 64000)",
      parsePositiveInteger,
    )
    .option("--batch-size <n>", "comments requested per AI batch", parsePositiveInteger, 50)
    .option("--api-key <key>", "Anthropic API key (prefer ANTHROPIC_API_KEY)")
    .option("--verbose", "show timings, scan details, selected reads, and batch progress", false);

  if (handlers.run) {
    program.action((path: string, options: MainOptions) => handlers.run!(path, options));
  }

  const serveCommand = program
    .command("serve <file>")
    .description("serve the browser UI for an existing scrutiny JSON file")
    .option("--port <n>", "preferred server port", parsePort, 3000)
    .option("--open", "open the browser UI", false)
    .addOption(new Option("--theme <name>", "browser UI theme").choices(THEMES).default("reddit"))
    .option("--verbose", "show resolved file, theme, and server details", false);

  serveCommand.action((file: string, options: ServeOptions) =>
    (handlers.serve ?? serve)(file, options),
  );

  program
    .command("completions")
    .description("print a shell completion script")
    .addArgument(
      new Argument("<shell>", "shell to generate completions for").choices(SUPPORTED_SHELLS),
    )
    .action(async (shell: Shell) => {
      if (handlers.completions) {
        await handlers.completions(shell);
        return;
      }
      const { renderCompletionScript } = await import("./completions");
      process.stdout.write(`${renderCompletionScript(program, shell)}\n`);
    });

  program.addHelpText(
    "after",
    `
Examples:
  $ reddit-scrutinizer ./my-project --subreddit rust
  $ reddit-scrutinizer ./my-project --comments 70 --style hostile --verbose
  $ reddit-scrutinizer serve ./reddit-scrutiny.json --theme hackernews --open
  $ reddit-scrutinizer completions zsh
`,
  );

  return program;
}

export const program = createProgram();
