import { describe, expect, test } from "bun:test";
import { createProgressReporter } from "../src/progress";

describe("progress reporter", () => {
  test("normal mode prints stages but hides details and timings", () => {
    const lines: string[] = [];
    const reporter = createProgressReporter({
      verbose: false,
      write: (line) => lines.push(line),
      now: () => 1_000,
    });

    const stage = reporter.stage(1, 8, "Rifling through the repo...");
    stage.detail("42 files, TypeScript everywhere");
    stage.complete("Found 3 suspicious little patterns");

    expect(lines).toEqual(["[1/8] Rifling through the repo..."]);
  });

  test("verbose mode prints details and elapsed time", () => {
    const lines: string[] = [];
    const times = [1_000, 2_250];
    const reporter = createProgressReporter({
      verbose: true,
      write: (line) => lines.push(line),
      now: () => times.shift() ?? 2_250,
    });

    const stage = reporter.stage(2, 8, "Checking under the floorboards...");
    stage.detail("7 risk signals across 3 files");
    stage.complete("Pattern scan complete");

    expect(lines).toEqual([
      "[2/8] Checking under the floorboards...",
      "  ↳ 7 risk signals across 3 files",
      "  ↳ Pattern scan complete (1.25s)",
    ]);
  });

  test("success messages are always visible", () => {
    const lines: string[] = [];
    const reporter = createProgressReporter({ verbose: false, write: (line) => lines.push(line) });
    reporter.success("Written to /tmp/result.json");
    expect(lines).toEqual(["✓ Written to /tmp/result.json"]);
  });
});
