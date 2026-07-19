import type { Argument, Command, Option } from "commander";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const SUPPORTED_SHELLS = ["bash", "zsh", "fish", "powershell"] as const;

export type Shell = (typeof SUPPORTED_SHELLS)[number];

export type CompletionKind = "none" | "value" | "file" | "directory" | "choices";

export interface CompletionOption {
  flags: string[];
  long?: string;
  short?: string;
  description: string;
  valueName?: string;
  kind: CompletionKind;
  choices: string[];
}

export interface CompletionArgument {
  name: string;
  description: string;
  required: boolean;
  kind: CompletionKind;
  choices: string[];
}

export interface CompletionModel {
  name: string;
  description: string;
  options: CompletionOption[];
  arguments: CompletionArgument[];
  subcommands: CompletionModel[];
}

function vibeNames(): string[] {
  return readdirSync(join(import.meta.dir, "../ai/vibes"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();
}

function valueName(flags: string): string | undefined {
  return flags.match(/[<[]([^>\]]+)[>\]]/)?.at(1);
}

function optionMeta(option: Option): CompletionOption {
  const choices = option.long === "--subreddit" ? vibeNames() : [...(option.argChoices ?? [])];
  const takesValue = option.required || option.optional;
  let kind: CompletionKind = takesValue ? "value" : "none";
  if (choices.length > 0) kind = "choices";
  if (option.long === "--out") kind = "file";

  return {
    flags: [option.short, option.long].filter((flag): flag is string => Boolean(flag)),
    long: option.long ?? undefined,
    short: option.short ?? undefined,
    description: option.description,
    valueName: valueName(option.flags),
    kind,
    choices,
  };
}

function argumentMeta(argument: Argument): CompletionArgument {
  const name = argument.name();
  const choices = [...(argument.argChoices ?? [])];
  let kind: CompletionKind = choices.length > 0 ? "choices" : "value";
  if (name === "path") kind = "directory";
  if (name === "file") kind = "file";

  return {
    name,
    description: argument.description,
    required: argument.required,
    kind,
    choices,
  };
}

function isHidden(command: Command): boolean {
  return Boolean((command as unknown as { _hidden?: boolean })._hidden);
}

export function buildCompletionModel(program: Command): CompletionModel {
  const options = program.createHelp().visibleOptions(program);

  return {
    name: program.name(),
    description: program.description(),
    options: options.map(optionMeta),
    arguments: program.registeredArguments.map(argumentMeta),
    subcommands: program.commands.filter((command) => !isHidden(command)).map(buildCompletionModel),
  };
}
