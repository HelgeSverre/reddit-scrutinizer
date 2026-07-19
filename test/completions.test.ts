import { describe, expect, test } from "bun:test";
import { createProgram } from "../src/cli";
import { renderCompletionScript } from "../src/completions";
import { buildCompletionModel, SUPPORTED_SHELLS, type Shell } from "../src/completions/model";

const markers: Record<Shell, string[]> = {
  bash: ["_reddit_scrutinizer()", "complete -F _reddit_scrutinizer reddit-scrutinizer"],
  zsh: ["#compdef reddit-scrutinizer", "compdef _reddit_scrutinizer reddit-scrutinizer"],
  fish: ["complete -c reddit-scrutinizer", "__fish_seen_subcommand_from serve"],
  powershell: ["Register-ArgumentCompleter", "-CommandName 'reddit-scrutinizer'"],
};

describe("completion model", () => {
  const model = buildCompletionModel(createProgram());

  test("reflects current commands and options", () => {
    expect(model.subcommands.map((command) => command.name)).toEqual(["serve", "completions"]);
    expect(model.options.some((option) => option.long === "--open")).toBe(true);
    expect(model.options.some((option) => option.long === "--no-ui")).toBe(false);
  });

  test("provides path and choice hints", () => {
    expect(model.arguments.at(0)?.kind).toBe("directory");
    expect(
      model.subcommands.find((command) => command.name === "serve")?.arguments.at(0)?.kind,
    ).toBe("file");
    expect(
      model.subcommands.find((command) => command.name === "completions")?.arguments.at(0)?.choices,
    ).toEqual([...SUPPORTED_SHELLS]);
    expect(model.options.find((option) => option.long === "--style")?.choices).toContain(
      "balanced",
    );
    expect(model.options.find((option) => option.long === "--subreddit")?.choices).toContain(
      "localllama",
    );
  });
});

describe("completion scripts", () => {
  for (const shell of SUPPORTED_SHELLS) {
    test(`renders ${shell} commands, options, and choices`, () => {
      const output = renderCompletionScript(createProgram(), shell);

      for (const marker of markers[shell]) {
        expect(output).toContain(marker);
      }
      const optionMarkers =
        shell === "fish" ? ["-l open", "-l subreddit"] : ["--open", "--subreddit"];
      for (const marker of optionMarkers) {
        expect(output).toContain(marker);
      }
      for (const expected of [
        "serve",
        "completions",
        "balanced",
        "reddit",
        "localllama",
        "bash",
        "powershell",
      ]) {
        expect(output).toContain(expected);
      }
    });
  }

  test("keeps zsh command descriptions in one completion candidate", () => {
    const output = renderCompletionScript(createProgram(), "zsh");
    expect(output).toContain("serve\\:serve\\ the\\ browser\\ UI");
    expect(output).toContain("'1:shell:(bash zsh fish powershell)'");
  });

  test("locates the previous PowerShell token relative to the partial word", () => {
    const output = renderCompletionScript(createProgram(), "powershell");
    expect(output).toContain("$elements[-1] -eq $wordToComplete");
    expect(output).toContain("$elements.Count - 2");
  });

  test("suppresses Fish path suggestions while completing an option value", () => {
    const output = renderCompletionScript(createProgram(), "fish");
    expect(output).toContain("function __fish_reddit_scrutinizer_accepts_positional");
    expect(output).toContain("case '--style'");
    expect(output).toContain("-l style -x -a 'balanced snarky supportive hostile'");
    expect(output).toContain(
      "__fish_reddit_scrutinizer_accepts_positional; and not __fish_seen_subcommand_from serve completions",
    );
  });

  test("scopes Fish root options away from subcommands", () => {
    const output = renderCompletionScript(createProgram(), "fish");
    expect(output).toContain("-n 'not __fish_seen_subcommand_from serve completions' -l comments");
  });
});
