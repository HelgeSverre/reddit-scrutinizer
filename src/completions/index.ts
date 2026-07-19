import type { Command } from "commander";
import { render as renderBash } from "./bash";
import { render as renderFish } from "./fish";
import { buildCompletionModel, type CompletionModel, type Shell } from "./model";
import { render as renderPowerShell } from "./powershell";
import { render as renderZsh } from "./zsh";

const RENDERERS: Record<Shell, (model: CompletionModel) => string> = {
  bash: renderBash,
  zsh: renderZsh,
  fish: renderFish,
  powershell: renderPowerShell,
};

export function renderCompletionScript(program: Command, shell: Shell): string {
  return RENDERERS[shell](buildCompletionModel(program));
}
