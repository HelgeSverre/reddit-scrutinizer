import { Command, Option } from "commander";

const program = new Command();

program
  .name("reddit-scrutinizer")
  .description("Simulate how Reddit would roast your project")
  .version("0.1.0");

program
  .argument("<path>", "path to the project to scrutinize")
  .option("--subreddit <name>", "subreddit to simulate", "programming")
  .option("--comments <n>", "number of comments to generate", parseInt, 40)
  .option("--max-depth <n>", "maximum comment thread depth", parseInt, 4)
  .option("--max-replies <n>", "maximum OP replies", parseInt, 3)
  .addOption(
    new Option("--style <mode>", "comment style")
      .choices(["balanced", "snarky", "supportive", "hostile"])
      .default("balanced"),
  )
  .option("--model <name>", "Anthropic model to use", "claude-sonnet-4-20250514")
  .option("--out <file>", "output JSON file path", "./reddit-scrutiny.json")
  .option("--open", "open UI in browser after generation", false)
  .option("--port <n>", "UI server port", parseInt, 3000)
  .option("--no-ui", "skip starting the UI server")
  .option("--temperature <n>", "LLM temperature", parseFloat, 0.8)
  .option("--seed <n>", "random seed for reproducibility", parseInt);

program
  .command("serve <file>")
  .description("Serve the UI for an existing scrutiny JSON file")
  .option("--port <n>", "server port", parseInt, 3000)
  .option("--open", "open UI in browser", false)
  .action(async (file: string, opts: { port: number; open: boolean }) => {
    const { startServer } = await import("./ui/server");
    await startServer(file, opts.port, opts.open);
  });

export function parseArgs() {
  const options = program.opts();
  const path = program.args[0];
  return { path, options };
}

export { program };
