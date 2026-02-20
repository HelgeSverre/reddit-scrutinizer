import { Command, Option } from "commander";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));

const toInt = (v: string) => parseInt(v, 10);
const toFloat = (v: string) => parseFloat(v);

const program = new Command();

program
  .name("reddit-scrutinizer")
  .description("Simulate how Reddit would roast your project")
  .version(pkg.version)
  .enablePositionalOptions()
  .passThroughOptions();

program
  .argument("<path>", "path to the project to scrutinize")
  .option("--subreddit <name>", "subreddit to simulate", "programming")
  .option("--comments <n>", "number of comments to generate", toInt, 40)
  .option("--max-depth <n>", "maximum comment thread depth", toInt, 4)
  .option("--max-replies <n>", "maximum OP replies", toInt, 3)
  .addOption(
    new Option("--style <mode>", "comment style")
      .choices(["balanced", "snarky", "supportive", "hostile"])
      .default("balanced"),
  )
  .addOption(
    new Option("--theme <name>", "UI theme")
      .choices(["reddit", "hackernews", "producthunt", "twitter", "bluesky", "qdb"])
      .default("reddit"),
  )
  .option("--model <name>", "Anthropic model to use", "claude-sonnet-4-5-20250929")
  .option("--out <file>", "output JSON file path", "./reddit-scrutiny.json")
  .option("--open", "open UI in browser after generation", false)
  .option("--port <n>", "UI server port", toInt, 3000)
  .option("--no-ui", "skip starting the UI server")
  .option("--temperature <n>", "LLM temperature", toFloat, 0.8)
  .option("--seed <n>", "random seed for reproducibility", toInt)
  .option("--max-tokens <n>", "max output tokens per API call (default: auto-scaled, max 64000)", toInt)
  .option("--batch-size <n>", "comments per batch when generating large counts", toInt, 50)
  .option("--api-key <key>", "Anthropic API key (overrides ANTHROPIC_API_KEY env var)");

program
  .command("serve <file>")
  .description("Serve the UI for an existing scrutiny JSON file")
  .option("--port <n>", "server port", toInt, 3000)
  .option("--open", "open UI in browser", false)
  .addOption(
    new Option("--theme <name>", "UI theme")
      .choices(["reddit", "hackernews", "producthunt", "twitter", "bluesky", "qdb"])
      .default("reddit"),
  )
  .action(async (file: string, opts: { port: number; open: boolean; theme: string }) => {
    const { startServer } = await import("./ui/server");
    const actualPort = await startServer(file, opts.port, opts.open, opts.theme);
    console.log(`UI available at http://localhost:${actualPort}`);
  });

export function parseArgs() {
  const options = program.opts();
  const path = program.args[0];
  return { path, options };
}

export { program };
